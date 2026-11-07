/**
 * src/engine/runner/mock.ts
 * Deterministic Mock Process Runner for unit, integration, and E2E offline testing.
 * Supports rule matching, response queues, simulated delays, cancellation, and error injection.
 */

import type {
  IProcessRunner,
  IProcessHandle,
  ProcessResult,
  ProcessOptions,
  StreamCallbacks,
  MockProcessResponse,
  MockResponseRule,
  ProcessInvocation,
} from './types';

export class MockProcessHandle implements IProcessHandle {
  public readonly pid: number;
  private _isKilled = false;
  private _isDone = false;
  private _timers: Set<NodeJS.Timeout> = new Set();
  private _waitPromise: Promise<ProcessResult>;
  private _resolveWait!: (res: ProcessResult) => void;
  private _rejectWait!: (err: Error) => void;
  private _stdoutAccum = '';
  private _stderrAccum = '';

  constructor(
    private callbacks?: StreamCallbacks,
    private response?: MockProcessResponse
  ) {
    this.pid = 1000 + Math.floor(Math.random() * 9000);

    this._waitPromise = new Promise((resolve, reject) => {
      this._resolveWait = resolve;
      this._rejectWait = reject;
    });

    this.start();
  }

  get isKilled(): boolean {
    return this._isKilled;
  }

  get isDone(): boolean {
    return this._isDone;
  }

  async kill(signal: string = 'SIGKILL'): Promise<void> {
    if (this._isDone || this._isKilled) return;
    this._isKilled = true;

    for (const timer of this._timers) {
      clearTimeout(timer);
    }
    this._timers.clear();

    const exitCode = signal === 'SIGTERM' ? 143 : 137;
    this._isDone = true;
    this.callbacks?.onExit?.(exitCode, signal);
    this._resolveWait({
      stdout: this._stdoutAccum,
      stderr: this._stderrAccum,
      exitCode,
    });
  }

  wait(): Promise<ProcessResult> {
    return this._waitPromise;
  }

  private start(): void {
    if (this.response?.spawnError) {
      queueMicrotask(() => {
        this._isDone = true;
        this.callbacks?.onError?.(this.response!.spawnError!);
        this._rejectWait(this.response!.spawnError!);
      });
      return;
    }

    const stdoutChunks = this.response?.stdoutChunks ?? [];
    const stderrChunks = this.response?.stderrChunks ?? [];
    const exitCode = this.response?.exitCode ?? 0;
    const delayMs = this.response?.delayMs ?? 0;

    const timeline: Array<{ type: 'stdout' | 'stderr'; chunk: string }> = [];
    for (const chunk of stdoutChunks) timeline.push({ type: 'stdout', chunk });
    for (const chunk of stderrChunks) timeline.push({ type: 'stderr', chunk });

    if (delayMs === 0) {
      queueMicrotask(() => {
        if (this._isKilled) return;
        for (const item of timeline) {
          if (this._isKilled) return;
          if (item.type === 'stdout') {
            this._stdoutAccum += item.chunk;
            this.callbacks?.onStdoutChunk?.(item.chunk);
          } else {
            this._stderrAccum += item.chunk;
            this.callbacks?.onStderrChunk?.(item.chunk);
          }
        }

        if (!this._isKilled) {
          this._isDone = true;
          this.callbacks?.onExit?.(exitCode, null);
          this._resolveWait({
            stdout: this._stdoutAccum,
            stderr: this._stderrAccum,
            exitCode,
          });
        }
      });
    } else {
      timeline.forEach((item, index) => {
        const timer = setTimeout(() => {
          this._timers.delete(timer);
          if (this._isKilled) return;
          if (item.type === 'stdout') {
            this._stdoutAccum += item.chunk;
            this.callbacks?.onStdoutChunk?.(item.chunk);
          } else {
            this._stderrAccum += item.chunk;
            this.callbacks?.onStderrChunk?.(item.chunk);
          }
        }, (index + 1) * delayMs);
        this._timers.add(timer);
      });

      const totalDelay = (timeline.length + 1) * delayMs;
      const endTimer = setTimeout(() => {
        this._timers.delete(endTimer);
        if (this._isKilled) return;
        this._isDone = true;
        this.callbacks?.onExit?.(exitCode, null);
        this._resolveWait({
          stdout: this._stdoutAccum,
          stderr: this._stderrAccum,
          exitCode,
        });
      }, totalDelay);
      this._timers.add(endTimer);
    }
  }
}

export class MockProcessRunner implements IProcessRunner {
  private rules: MockResponseRule[] = [];
  private responseQueue: MockProcessResponse[] = [];
  private defaultResponse: MockProcessResponse = { stdoutChunks: [''], exitCode: 0 };
  private invocations: ProcessInvocation[] = [];
  private strict = false;

  setStrict(strict: boolean): this {
    this.strict = strict;
    return this;
  }

  setDefaultResponse(response: MockProcessResponse): this {
    this.defaultResponse = response;
    return this;
  }

  queueResponse(response: MockProcessResponse): this {
    this.responseQueue.push(response);
    return this;
  }

  registerRule(rule: MockResponseRule): this {
    this.rules.push(rule);
    return this;
  }

  onCommand(
    matcher: string | RegExp | ((command: string, args: string[]) => boolean),
    response: MockProcessResponse | ((cmd: string, args: string[]) => MockProcessResponse),
    times: number = Infinity
  ): this {
    let matchFn: (cmd: string, args: string[]) => boolean;

    if (typeof matcher === 'string') {
      matchFn = (cmd, args) => cmd === matcher || `${cmd} ${args.join(' ')}`.includes(matcher);
    } else if (matcher instanceof RegExp) {
      matchFn = (cmd, args) => matcher.test(`${cmd} ${args.join(' ')}`);
    } else {
      matchFn = matcher;
    }

    this.rules.push({ match: matchFn, response, times });
    return this;
  }

  getInvocations(): ProcessInvocation[] {
    return [...this.invocations];
  }

  getLastInvocation(): ProcessInvocation | undefined {
    return this.invocations[this.invocations.length - 1];
  }

  clearInvocations(): void {
    this.invocations = [];
  }

  reset(): void {
    this.rules = [];
    this.responseQueue = [];
    this.invocations = [];
    this.defaultResponse = { stdoutChunks: [''], exitCode: 0 };
    this.strict = false;
  }

  private resolveResponse(command: string, args: string[]): MockProcessResponse {
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }

    for (let i = 0; i < this.rules.length; i++) {
      const rule = this.rules[i];
      if (rule.match(command, args)) {
        if (rule.times !== undefined && rule.times !== Infinity) {
          rule.times--;
          if (rule.times <= 0) {
            this.rules.splice(i, 1);
          }
        }
        return typeof rule.response === 'function' ? rule.response(command, args) : rule.response;
      }
    }

    if (this.strict) {
      throw new Error(`MockProcessRunner [STRICT]: No mock response registered for "${command} ${args.join(' ')}"`);
    }

    return this.defaultResponse;
  }

  spawnStream(
    command: string,
    args: string[],
    callbacks?: StreamCallbacks,
    options?: ProcessOptions
  ): IProcessHandle {
    this.invocations.push({
      command,
      args: [...args],
      options,
      timestamp: Date.now(),
    });

    let resp: MockProcessResponse;
    try {
      resp = this.resolveResponse(command, args);
    } catch (err: any) {
      resp = { spawnError: err };
    }

    return new MockProcessHandle(callbacks, resp);
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

/** Pre-canned Mock Helpers for downstream test writing */
export function mockYtDlpMetadata(metadata: Record<string, unknown>): MockProcessResponse {
  return {
    stdoutChunks: [JSON.stringify(metadata)],
    exitCode: 0,
  };
}

export function mockYtDlpDownload(destination: string, steps = 4): MockProcessResponse {
  const chunks: string[] = [`[download] Destination: ${destination}\n`];
  for (let i = 1; i <= steps; i++) {
    const percent = ((i / steps) * 100).toFixed(1);
    chunks.push(`[download]  ${percent}% of ~  20.00MiB at  2.50MiB/s ETA 00:0${steps - i}\n`);
  }
  chunks.push(`[download] 100% of  20.00MiB in 00:04\n`);
  return { stdoutChunks: chunks, exitCode: 0 };
}

export function mockYtDlpError(errorMessage: string, exitCode = 1): MockProcessResponse {
  return {
    stderrChunks: [`ERROR: ${errorMessage}\n`],
    exitCode,
  };
}
