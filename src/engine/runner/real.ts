/**
 * src/engine/runner/real.ts
 * Production process runner utilizing Node.js child_process.spawn
 * with cross-platform process tree termination and stream buffering.
 */

import { spawn, ChildProcess } from 'child_process';
import type {
  IProcessRunner,
  IProcessHandle,
  ProcessResult,
  ProcessOptions,
  StreamCallbacks,
} from './types';

class RealProcessHandle implements IProcessHandle {
  private child: ChildProcess;
  private _waitPromise: Promise<ProcessResult>;
  private isClosed = false;
  private isKilled = false;
  private isDetached: boolean;

  constructor(
    child: ChildProcess,
    callbacks?: StreamCallbacks,
    options?: ProcessOptions
  ) {
    this.child = child;
    this.isDetached = options?.detached ?? (process.platform !== 'win32');

    this._waitPromise = new Promise((resolve, reject) => {
      let stdoutAccum = '';
      let stderrAccum = '';
      let hasError = false;

      if (this.child.stdout) {
        this.child.stdout.setEncoding('utf8');
        this.child.stdout.on('data', (chunk: string) => {
          stdoutAccum += chunk;
          callbacks?.onStdoutChunk?.(chunk);
        });
      }

      if (this.child.stderr) {
        this.child.stderr.setEncoding('utf8');
        this.child.stderr.on('data', (chunk: string) => {
          stderrAccum += chunk;
          callbacks?.onStderrChunk?.(chunk);
        });
      }

      this.child.on('error', (err: Error) => {
        hasError = true;
        callbacks?.onError?.(err);
        reject(err);
      });

      this.child.on('close', (code: number | null, signal: string | null) => {
        this.isClosed = true;
        if (hasError) return;

        let normalizedCode = 0;
        if (code !== null) {
          normalizedCode = code;
        } else if (signal === 'SIGKILL') {
          normalizedCode = 137;
        } else if (signal === 'SIGTERM') {
          normalizedCode = 143;
        } else if (signal === 'SIGINT') {
          normalizedCode = 130;
        } else {
          normalizedCode = signal ? 1 : 0;
        }

        callbacks?.onExit?.(normalizedCode, signal);
        resolve({
          stdout: stdoutAccum,
          stderr: stderrAccum,
          exitCode: normalizedCode,
        });
      });
    });

    // Suppress unhandled promise rejection warnings if consumer only uses callbacks or awaits wait() later
    this._waitPromise.catch(() => {});
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  async kill(signal: string = 'SIGKILL'): Promise<void> {
    if (this.isClosed || this.isKilled) return;
    this.isKilled = true;

    if (!this.child.pid) {
      try {
        this.child.kill(signal as NodeJS.Signals);
      } catch {}
      return;
    }

    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        try {
          const killer = spawn('taskkill', ['/pid', String(this.child.pid), '/f', '/t'], {
            stdio: 'ignore',
          });
          killer.on('close', () => resolve());
          killer.on('error', () => {
            try { this.child.kill(signal as NodeJS.Signals); } catch {}
            resolve();
          });
        } catch {
          try { this.child.kill(signal as NodeJS.Signals); } catch {}
          resolve();
        }
      });
    } else {
      if (this.isDetached) {
        try {
          // Detached processes on POSIX form a process group with PGID = PID
          process.kill(-this.child.pid, signal as NodeJS.Signals);
        } catch {
          try { this.child.kill(signal as NodeJS.Signals); } catch {}
        }
      } else {
        try { this.child.kill(signal as NodeJS.Signals); } catch {}
      }
    }
  }

  wait(): Promise<ProcessResult> {
    return this._waitPromise;
  }
}

export class RealProcessRunner implements IProcessRunner {
  spawnStream(
    command: string,
    args: string[],
    callbacks?: StreamCallbacks,
    options?: ProcessOptions
  ): IProcessHandle {
    const isWin = process.platform === 'win32';
    const detached = options?.detached ?? !isWin;

    const child = spawn(command, args, {
      cwd: options?.cwd,
      env: options?.env ? { ...process.env, ...options.env } : process.env,
      detached,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: options?.shell ?? false,
    });

    return new RealProcessHandle(child, callbacks, options);
  }

  async exec(
    command: string,
    args: string[],
    options?: ProcessOptions
  ): Promise<ProcessResult> {
    const handle = this.spawnStream(command, args, undefined, options);
    return handle.wait();
  }
}
