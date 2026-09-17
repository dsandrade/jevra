import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

test('host-managed MCP exposes bounded reading tools and preserves file scope and read-only behavior', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'jevra-mcp-')));
  const client = new Client({ name: 'jevra-test', version: '1.0.0' });
  try {
    const cwd = join(root, 'workspace');
    await mkdir(cwd);
    await mkdir(join(cwd, 'skills'));
    await writeFile(join(cwd, 'rules.md'), '# Rules\nValidation rejects noninteger retry attempts.\n');
    await writeFile(join(root, 'outside.md'), 'PRIVATE_MARKER');
    const config = join(root, 'config.json');
    await writeFile(config, JSON.stringify({ version: 1, mode: 'advise', skillRoots: [join(cwd, 'skills')], traces: false,
      bulkRead: { roots: [cwd], backend: 'deterministic' } }));
    await client.connect(new StdioClientTransport({ command: process.execPath,
      args: [resolve('dist/jevra.mjs'), 'mcp', '--host', 'codex', '--config', config], cwd, stderr: 'pipe' }));
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(), ['bulk_read', 'code_context']);
    assert.ok(tools.tools.every(t => t.annotations?.readOnlyHint && t.annotations?.openWorldHint));
    for (const [name, args] of [
      ['bulk_read', { question: 'retry validation', paths: ['rules.md'] }],
      ['code_context', { spec: 'retry validation', references: ['rules.md'] }],
    ] as const) {
      const result = await client.callTool({ name, arguments: args });
      assert.notEqual(result.isError, true);
      assert.match(JSON.stringify(result.content), /Validation rejects noninteger/);
    }
    const forbidden = await client.callTool({ name: 'bulk_read', arguments: { question: 'private', paths: ['../outside.md'] } });
    assert.equal(forbidden.isError, true);
    assert.doesNotMatch(JSON.stringify(forbidden), /PRIVATE_MARKER/);
    const empty = await client.callTool({ name: 'bulk_read', arguments: { question: '', paths: ['rules.md'] } });
    assert.equal(empty.isError, true);
  } finally { await client.close(); await rm(root, { recursive: true, force: true }); }
});
