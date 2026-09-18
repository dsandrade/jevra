import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyze } from './analyze.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node evals/artifact-comparison/summarize.ts <results.json> <summary.json>');
const result = analyze(JSON.parse(await readFile(resolve(input), 'utf8')));
await writeFile(resolve(output), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ output: resolve(output), attempted: result.attempted, missing: result.missing, gates: result.gates }, null, 2));
