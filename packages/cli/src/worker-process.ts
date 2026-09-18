import { spawn } from 'node:child_process';

export type ProcessFailure = 'executable_unavailable' | 'timeout' | 'cancelled' | 'output_limit' | 'process_failed';
export interface ProcessResult {
  stdout: Buffer;
  stderr: Buffer;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  failure: ProcessFailure | null;
  cleanupComplete: boolean;
}

/** POSIX process group ownership prevents grandchildren from surviving cancellation. */
export async function runWorkerProcess(options: {
  executable: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv;
  input?: string; signal?: AbortSignal; timeoutMs: number; killGraceMs: number;
  maxOutputBytes: number; maxStderrBytes: number;
  onStdout?: (data: Buffer, stop: () => void) => void;
}): Promise<ProcessResult> {
  if (options.signal?.aborted) return { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0),
    stdoutBytes: 0, stderrBytes: 0, exitCode: null, failure: 'cancelled', cleanupComplete: true };
  return new Promise(resolve => {
    const stdout: Buffer[] = [], stderr: Buffer[] = [];
    let stdoutBytes = 0, stderrBytes = 0, failure: ProcessFailure | null = null;
    let exitCode: number | null = null, finished = false, stopped = false;
    let cleanupComplete = true;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(options.executable, options.args, {
      cwd: options.cwd, env: options.env, shell: false, detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const killGroup = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try { process.kill(-child.pid, signal); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') cleanupComplete = false; }
    };
    const groupExists = () => {
      if (!child.pid) return false;
      try { process.kill(-child.pid, 0); return true; } catch { return false; }
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); clearTimeout(killTimer); clearTimeout(cleanupTimer);
      options.signal?.removeEventListener('abort', onAbort);
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
      resolve({ stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr),
        stdoutBytes, stderrBytes, exitCode, failure, cleanupComplete });
    };
    const forceCleanup = () => {
      killGroup('SIGKILL');
      const deadline = performance.now() + 1000;
      const check = () => {
        if (finished) return;
        if (!groupExists()) { finish(); return; }
        if (performance.now() >= deadline) { cleanupComplete = false; finish(); return; }
        cleanupTimer = setTimeout(check, 10);
      };
      check();
    };
    const stop = (reason?: ProcessFailure) => {
      failure ??= reason ?? 'process_failed';
      if (stopped) return;
      stopped = true;
      child.stdin.destroy();
      killGroup('SIGTERM');
      killTimer = setTimeout(forceCleanup, options.killGraceMs);
    };
    const onAbort = () => stop('cancelled');
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs);
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    child.stdout.on('data', (data: Buffer) => {
      if (finished || stopped) return;
      stdoutBytes += data.length;
      if (stdoutBytes > options.maxOutputBytes) { stop('output_limit'); return; }
      stdout.push(data);
      try { options.onStdout?.(data, () => stop()); } catch { stop('process_failed'); }
    });
    child.stderr.on('data', (data: Buffer) => {
      if (finished || stopped) return;
      stderrBytes += data.length;
      if (stderrBytes > options.maxStderrBytes) { stop('output_limit'); return; }
      stderr.push(data);
    });
    child.stdin.on('error', () => { /* Exit/error events determine the outcome. */ });
    child.once('error', () => { failure ??= 'executable_unavailable'; finish(); });
    child.once('exit', code => { exitCode = code; });
    child.once('close', code => {
      exitCode = code;
      if (finished) return;
      // A child can exit while a grandchild survives with stdio closed.
      if (groupExists()) {
        if (!stopped) {
          stopped = true;
          killGroup('SIGTERM');
          killTimer = setTimeout(forceCleanup, options.killGraceMs);
        }
      } else finish();
    });
    if (!stopped) child.stdin.end(options.input ?? '');
  });
}
