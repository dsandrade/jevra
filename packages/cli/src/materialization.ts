import { constants } from 'node:fs';
import { open, mkdir, lstat, realpath, link, rm } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { DecisionError, hash, MODEL } from '@jevra/core';
import { evidenceHash } from '@jevra/core/managed-worker';
import type { Config } from './config.ts';
import type { ArtifactHandle } from '../../core/src/artifact.ts';
import { NodeTestArtifacts } from './test-artifacts.ts';

const uuid = z.string().uuid(), digest = z.string().regex(/^[a-f0-9]{64}$/);
const path = z.string().min(1).max(4096).refine(isAbsolute);
const ticketSchema = z.object({
  version: z.literal(1), id: uuid, sessionId: uuid, workspace: path,
  profileId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), configurationHash: digest,
  source: path, sourceHash: digest, destination: path, candidateHash: digest,
  bytes: z.number().int().min(1).max(32768), issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().nonnegative(),
}).strict();
const envelopeSchema = z.object({ ticket: ticketSchema, mac: digest }).strict();
export interface NativeApplicationContext { configFile: string; cliFile: string }
export interface MaterializationHandle { id: string; sessionId: string; candidateHash: string; bytes: number; expiresAt: number }
const TTL = 600000;
const inside = (root: string, file: string) => { const p = relative(root, file);
  return p === '' || p !== '..' && !p.startsWith('../') && !isAbsolute(p); };
const settings = (config: Config) => {
  if (config.mode !== 'advise' || config.model !== MODEL || !config.testArtifacts?.enabled
    || config.testArtifacts.delivery !== 'native-ticket' || process.env.JEVRA_WORKER_ACTIVE === '1') {
    throw new DecisionError('config_invalid');
  }
  return config.testArtifacts;
};
const fingerprint = (config: Config) => hash({ mode: config.mode, model: config.model, artifacts: settings(config) });

async function directory(p: string, create = false) {
  if (create) await mkdir(p, { recursive: true, mode: 0o700 });
  const s = await lstat(p);
  if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== process.getuid?.() || (s.mode & 0o077)
    || await realpath(p) !== p) throw new DecisionError('input_invalid');
}
async function read(p: string, max: number, privateFile = true): Promise<Buffer> {
  if (await realpath(dirname(p)) !== dirname(p)) throw new DecisionError('stale_state');
  const fd = await open(p, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const s = await fd.stat();
    if (!s.isFile() || s.nlink !== 1 || s.size > max || privateFile && (s.uid !== process.getuid?.() || (s.mode & 0o077))) {
      throw new DecisionError('input_invalid');
    }
    const buffer = Buffer.alloc(max + 1); let size = 0;
    while (size < buffer.length) { const r = await fd.read(buffer, size, buffer.length - size, size);
      if (!r.bytesRead) break; size += r.bytesRead; }
    if (size > max) throw new DecisionError('input_invalid');
    return buffer.subarray(0, size);
  } finally { await fd.close(); }
}
async function createFile(p: string, data: Buffer | string) {
  const fd = await open(p, 'wx', 0o600);
  try { await fd.writeFile(data); await fd.sync(); } finally { await fd.close(); }
}
async function absent(p: string) {
  try { await lstat(p); throw new DecisionError('stale_state'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
async function rootFor(config: Config, workspace: string, create = false) {
  if (process.platform === 'win32' || process.versions.node !== '24.21.0'
    || await realpath(workspace) !== workspace) throw new DecisionError('config_invalid');
  const root = resolve(settings(config).stagingDirectory);
  if (inside(workspace, root)) throw new DecisionError('config_invalid');
  await directory(root, create);
  const store = join(root, 'native-tickets'); await directory(store, create);
  return store;
}
async function signingKey(root: string, create = false) {
  const p = join(root, 'authority.key');
  if (create) {
    const key = randomBytes(32);
    try { await createFile(p, key); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    finally { key.fill(0); }
  }
  const key = await read(p, 32);
  if (key.length !== 32) throw new DecisionError('input_invalid');
  return key;
}
const mac = (key: Buffer, ticket: z.infer<typeof ticketSchema>) => createHmac('sha256', key).update(JSON.stringify(ticket)).digest();

/** Initialize the local artifact authority before spending inference. No provider credential is used. */
export async function prepareMaterialization(config: Config, workspace: string, context: NativeApplicationContext) {
  if (!isAbsolute(context.configFile) || !isAbsolute(context.cliFile) || inside(workspace, context.configFile)
    || await realpath(context.configFile) !== context.configFile) throw new DecisionError('config_invalid');
  const root = await rootFor(config, workspace, true);
  (await signingKey(root, true)).fill(0);
}

/** Only an internally accepted artifact can be exported. Never called by a standalone CLI command. */
export async function issueMaterialization(config: Config, workspace: string, sessionId: string, profileId: string,
  artifacts: NodeTestArtifacts, handle: ArtifactHandle, signal: AbortSignal): Promise<MaterializationHandle> {
  uuid.parse(sessionId);
  const profile = settings(config).profiles.find(p => p.id === profileId);
  if (!profile || !inside(workspace, profile.sourcePath)) throw new DecisionError('input_invalid');
  const { content, binding } = await artifacts.exportAccepted(handle, signal);
  if (evidenceHash(content) !== handle.candidateHash) throw new DecisionError('stale_state');
  const root = await rootFor(config, workspace), session = join(root, sessionId);
  await directory(session, true);
  const id = randomUUID(), issuedAt = Date.now();
  const ticket = ticketSchema.parse({ version: 1, id, sessionId, workspace, profileId,
    configurationHash: fingerprint(config), source: profile.sourcePath,
    sourceHash: binding.evidenceHashes.target_source, destination: join(dirname(profile.sourcePath), profile.outputName),
    candidateHash: handle.candidateHash, bytes: handle.bytes, issuedAt, expiresAt: issuedAt + TTL });
  const key = await signingKey(root);
  try {
    signal.throwIfAborted();
    await createFile(join(session, id + '.ts'), content);
    await createFile(join(session, id + '.json'), JSON.stringify({ ticket, mac: mac(key, ticket).toString('hex') }));
    signal.throwIfAborted();
    return { id, sessionId, candidateHash: ticket.candidateHash, bytes: ticket.bytes, expiresAt: ticket.expiresAt };
  } catch (error) {
    await Promise.all([rm(join(session, id + '.ts'), { force: true }), rm(join(session, id + '.json'), { force: true })]);
    throw error;
  } finally { key.fill(0); }
}

export function materializeCommand(context: NativeApplicationContext, handle: MaterializationHandle) {
  const quote = (v: string) => `'${v.replaceAll("'", "'\\''")}'`;
  return [process.execPath, context.cliFile, 'materialize-test', '--config', context.configFile,
    '--session-id', handle.sessionId, '--ticket', handle.id].map(quote).join(' ');
}

/** Runs inside the native host's command permissions. No network, generator, shell or target override. */
export async function materializeTest(config: Config, workspace: string, sessionId: string, id: string, signal: AbortSignal) {
  if (!uuid.safeParse(sessionId).success || !uuid.safeParse(id).success) throw new DecisionError('input_invalid');
  workspace = resolve(workspace);
  const root = await rootFor(config, workspace), session = join(root, sessionId);
  await directory(session);
  const envelope = envelopeSchema.parse(JSON.parse((await read(join(session, id + '.json'), 32768)).toString('utf8')));
  const { ticket } = envelope, key = await signingKey(root);
  try {
    if (!timingSafeEqual(mac(key, ticket), Buffer.from(envelope.mac, 'hex'))) throw new DecisionError('input_invalid');
  } finally { key.fill(0); }
  const profile = settings(config).profiles.find(p => p.id === ticket.profileId);
  if (ticket.id !== id || ticket.sessionId !== sessionId || ticket.workspace !== workspace
    || ticket.configurationHash !== fingerprint(config) || !profile || profile.sourcePath !== ticket.source
    || !inside(workspace, ticket.source) || join(dirname(profile.sourcePath), profile.outputName) !== ticket.destination) {
    throw new DecisionError('input_invalid');
  }
  const candidate = await read(join(session, id + '.ts'), 32768);
  if (candidate.length !== ticket.bytes || evidenceHash(candidate.toString('utf8')) !== ticket.candidateHash
    || !Buffer.from(candidate.toString('utf8')).equals(candidate)) throw new DecisionError('stale_state');
  const fresh = async () => {
    signal.throwIfAborted();
    const rawSource = await read(ticket.source, 32768, false);
    if (!Buffer.from(rawSource.toString('utf8')).equals(rawSource)) throw new DecisionError('stale_state');
    if (Date.now() < ticket.issuedAt || Date.now() >= ticket.expiresAt || ticket.expiresAt - ticket.issuedAt !== TTL
      || await realpath(dirname(ticket.destination)) !== dirname(ticket.destination)
      || evidenceHash(rawSource.toString('utf8')) !== ticket.sourceHash) {
      throw new DecisionError('stale_state');
    }
    await absent(ticket.destination);
  };
  await fresh();
  // Exclusive reservation is never removed: a crash or rejected publish cannot authorize a second attempt.
  await createFile(join(session, id + '.claimed'), JSON.stringify({ version: 1, claimedAt: Date.now() }));
  const temporary = join(dirname(ticket.destination), '.jevra-' + randomUUID() + '.tmp');
  let published = false;
  try {
    await createFile(temporary, candidate); await fresh();
    await link(temporary, ticket.destination); published = true;
    await rm(temporary);
    const result = { status: 'applied' as const, candidateHash: ticket.candidateHash, bytes: ticket.bytes,
      destination: relative(workspace, ticket.destination), sourceUnchangedAtPublishCheck: true,
      postApplyChecks: 'not_run' as const, inferenceCalls: 0 };
    // Publication already happened. A metadata failure must not invite another write.
    let receiptRecorded = true;
    try { await createFile(join(session, id + '.applied.json'), JSON.stringify(result)); }
    catch { receiptRecorded = false; }
    return { ...result, receiptRecorded };
  } catch (error) {
    if (published) return { status: 'applied', candidateHash: ticket.candidateHash,
      destination: relative(workspace, ticket.destination), receiptRecorded: false, cleanupComplete: false,
      postApplyChecks: 'not_run', inferenceCalls: 0 };
    throw error;
  } finally { await rm(temporary, { force: true }).catch(() => {}); }
}
