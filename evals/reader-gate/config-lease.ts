import { open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hash } from '@jevra/core';

/** One prepared scope cannot buy concurrent attempts or lose an unrelated config edit. */
export async function withGateConfig<T>(path: string, expectedHash: string, active: string, run: () => Promise<T>): Promise<T> {
  const lockPath = path + '.task.lock', temporary = path + '.' + randomUUID() + '.tmp';
  const lock = await open(lockPath, 'wx', 0o600);
  let original: string | undefined, replaced = false;
  try {
    original = await readFile(path, 'utf8'); if (hash(original) !== expectedHash) throw new Error('changed_gate_configuration');
    await writeFile(temporary, active, { mode: 0o600, flag: 'wx' }); await rename(temporary, path); replaced = true;
    return await run();
  } finally {
    try {
      if (replaced) {
        if (hash(await readFile(path, 'utf8')) !== hash(active)) throw new Error('gate_configuration_changed_during_task');
        await writeFile(temporary, original!, { mode: 0o600, flag: 'wx' }); await rename(temporary, path);
      }
    } finally { await rm(temporary, { force: true }); await lock.close(); await rm(lockPath); }
  }
}
