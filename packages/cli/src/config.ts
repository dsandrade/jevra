import { open, mkdir, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { DecisionError, MODEL, modeSchema, policySchema } from '@jevra/core';

const absolutePath = z.string().min(1).max(4096).refine(isAbsolute);
export const configSchema = z.object({
  version: z.literal(1),
  mode: modeSchema.default('observe'),
  model: z.string().regex(/^jev-\d+\.\d+\.\d+$/).default(MODEL),
  skillRoots: z.array(absolutePath).min(1).max(16),
  stateDirectory: absolutePath.optional(),
  keychainService: z.string().regex(/^[a-zA-Z0-9._-]{1,128}$/).optional(),
  timeoutMs: z.number().int().min(100).max(10000).default(3000),
  maxRequestBytes: z.number().int().min(1024).max(131072).default(65536),
  maxSkills: z.number().int().min(1).max(128).default(64),
  policy: policySchema.default(() => policySchema.parse({})),
  traces: z.boolean().default(true),
  retentionDays: z.number().int().min(1).max(30).default(7),
}).strict();
export type Config = z.infer<typeof configSchema>;

export function configPath(explicit?: string): string {
  const file = explicit ?? process.env.JEVRA_CONFIG;
  return file ? resolve(file) : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'jevra', 'config.json');
}

export function statePath(config: Config): string {
  return config.stateDirectory ?? join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'jevra');
}

export async function loadConfig(path: string): Promise<Config> {
  let source: string;
  try {
    source = await readBoundedFile(path, 32768);
  } catch (error) {
    throw new DecisionError((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'config_missing' : 'config_invalid');
  }
  try {
    if (Buffer.byteLength(source) > 32768) throw new Error('size');
    return configSchema.parse(JSON.parse(source));
  } catch { throw new DecisionError('config_invalid'); }
}

export async function readBoundedFile(path: string, limit: number): Promise<string> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > limit) throw new DecisionError('input_invalid');
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, size);
      if (bytesRead === 0) break;
      size += bytesRead;
    }
    if (size > limit) throw new DecisionError('input_invalid');
    return buffer.subarray(0, size).toString('utf8');
  } finally { await file.close(); }
}

export async function initializeConfig(path: string, roots: string[], keychainService?: string): Promise<void> {
  const config = configSchema.parse({ version: 1, mode: 'observe', skillRoots: roots.map(r => resolve(r)), keychainService });
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // Never overwrite an existing configuration as part of initialization.
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}

export async function readApiKey(config: Config): Promise<string | undefined> {
  if (process.env.TYPESAFE_API_KEY?.trim()) return process.env.TYPESAFE_API_KEY.trim();
  if (config.keychainService && process.platform === 'darwin') {
    try {
      const { stdout } = await promisify(execFile)('/usr/bin/security',
        ['find-generic-password', '-s', config.keychainService, '-w'],
        { encoding: 'utf8', timeout: 2000, maxBuffer: 8192 });
      return stdout.trim() || undefined;
    } catch { return undefined; }
  }
  return undefined;
}
