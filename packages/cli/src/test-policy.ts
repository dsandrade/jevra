import { parse } from 'acorn';
import type { Node } from 'acorn';
import { stripTypeScriptTypes } from 'node:module';

// A closed AST grammar, not a blacklist. Only this grammar is executable in v1.
type Tree = Node & { [key: string]: unknown };
function tree(value: unknown): Tree { return value as Tree; }
function nodes(value: unknown): Tree[] { return value as Tree[]; }
function id(value: unknown, name: string): boolean { const n = tree(value); return n?.type === 'Identifier' && n.name === name; }
function literal(value: unknown): boolean {
  const n = tree(value);
  return n?.type === 'Literal' && (n.value === null || typeof n.value === 'boolean'
    || typeof n.value === 'string' || typeof n.value === 'number' && Number.isFinite(n.value))
    || n?.type === 'UnaryExpression' && n.operator === '-' && tree(n.argument)?.type === 'Literal'
      && typeof tree(n.argument).value === 'number' && Number.isFinite(tree(n.argument).value);
}
function pureExpression(value: unknown, parameters: string[]): boolean {
  const n = tree(value);
  if (literal(n)) return true;
  if (n?.type === 'Identifier') return parameters.includes(n.name as string);
  if (n?.type === 'UnaryExpression') return ['-', '+', '!'].includes(n.operator as string) && pureExpression(n.argument, parameters);
  if (n?.type === 'BinaryExpression' || n?.type === 'LogicalExpression') {
    return ['+', '-', '*', '/', '%', '**', '===', '!==', '<', '<=', '>', '>=', '&&', '||', '??'].includes(n.operator as string)
      && pureExpression(n.left, parameters) && pureExpression(n.right, parameters);
  }
  return n?.type === 'ConditionalExpression' && pureExpression(n.test, parameters)
    && pureExpression(n.consequent, parameters) && pureExpression(n.alternate, parameters);
}
function program(content: string): Tree[] {
  const stripped = stripTypeScriptTypes(content, { mode: 'strip' });
  return nodes(parse(stripped, { ecmaVersion: 'latest', sourceType: 'module' }).body);
}
export function validatePureModule(content: string, exportName: string): number {
  const body = program(content);
  if (body.length !== 1 || body[0]?.type !== 'ExportNamedDeclaration') throw new Error('unsupported_source');
  const fn = tree(body[0].declaration), params = nodes(fn.params);
  if (fn.type !== 'FunctionDeclaration' || !id(fn.id, exportName) || fn.async || fn.generator
    || params.length < 1 || params.length > 4 || params.some(p => p.type !== 'Identifier')) throw new Error('unsupported_source');
  const names = params.map(p => p.name as string);
  const statements = nodes(tree(fn.body).body);
  if (new Set(names).size !== names.length || statements.length !== 1 || statements[0]?.type !== 'ReturnStatement'
    || !pureExpression(statements[0].argument, names)) throw new Error('unsupported_source');
  return names.length;
}

export function validateTestModule(content: string, sourceName: string, exportName: string, arity: number):
  { valid: true; tests: number } | { valid: false; reason: 'invalid_syntax' | 'unsupported_syntax' } {
  let body: Tree[];
  try { body = program(content); } catch { return { valid: false, reason: 'invalid_syntax' }; }
  const bad = { valid: false as const, reason: 'unsupported_syntax' as const };
  const imports = new Map<string, string>();
  let testName = '', assertName = '', targetName = '', tests = 0;
  for (const statement of body) {
    if (statement.type === 'ImportDeclaration' && tests === 0) {
      const specifiers = nodes(statement.specifiers), source = tree(statement.source).value;
      if (specifiers.length !== 1) return bad;
      const specifier = specifiers[0]!, local = tree(specifier.local).name;
      if (typeof local !== 'string' || imports.has(local)) return bad;
      const named = (name: string) => specifier.type === 'ImportSpecifier' && id(specifier.imported, name);
      if (source === 'node:test' && !testName && (specifier.type === 'ImportDefaultSpecifier' || named('test'))) testName = local;
      else if (source === 'node:assert/strict' && !assertName && specifier.type === 'ImportDefaultSpecifier') assertName = local;
      else if (source === './' + sourceName && !targetName && named(exportName)) targetName = local;
      else return bad;
      imports.set(local, String(source));
      continue;
    }
    const call = tree(statement.expression), args = nodes(call?.arguments);
    if (!testName || !assertName || !targetName || statement.type !== 'ExpressionStatement'
      || call?.type !== 'CallExpression' || call.optional || !id(call.callee, testName) || args.length !== 2) return bad;
    const label = args[0]!, fn = args[1]!;
    if (label.type !== 'Literal' || typeof label.value !== 'string' || !/^[^\r\n]{1,160}$/.test(label.value)
      || !['ArrowFunctionExpression', 'FunctionExpression'].includes(fn.type) || fn.async || fn.generator || fn.id
      || nodes(fn.params).length || tree(fn.body).type !== 'BlockStatement') return bad;
    const assertions = nodes(tree(fn.body).body);
    if (assertions.length < 1 || assertions.length > 32) return bad;
    for (const assertion of assertions) {
      const a = tree(assertion.expression), member = tree(a?.callee), values = nodes(a?.arguments);
      if (assertion.type !== 'ExpressionStatement' || a?.type !== 'CallExpression' || a.optional
        || member?.type !== 'MemberExpression' || member.computed || member.optional || !id(member.object, assertName)
        || !['equal', 'strictEqual'].some(name => id(member.property, name)) || values.length !== 2) return bad;
      const actual = values[0]!, targetArgs = nodes(actual.arguments);
      if (actual.type !== 'CallExpression' || actual.optional || !id(actual.callee, targetName)
        || targetArgs.length !== arity || !targetArgs.every(literal) || !literal(values[1])) return bad;
    }
    tests++;
    if (tests > 32) return bad;
  }
  return tests > 0 ? { valid: true, tests } : bad;
}
