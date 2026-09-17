import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Only used by the explicit host smoke test in its temporary workspace.
const directory = process.env.JEVRA_PROBE_DIRECTORY;
if (!directory) throw new Error('Missing isolated probe directory.');
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
await writeFile(join(directory, 'received.json'), JSON.stringify(payload), { mode: 0o600 });
const marker = (await readFile(join(directory, 'marker.txt'), 'utf8')).trim();
console.log(JSON.stringify({ hookSpecificOutput: {
  hookEventName: 'UserPromptSubmit', additionalContext: `The verification marker is ${marker}. Return that marker when requested.`,
} }));
