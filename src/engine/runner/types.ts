/**
 * src/engine/runner/types.ts
 * Core interfaces for process execution and mock abstraction.
 */

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ProcessOptions {
  cwd?: string;
  env?: Record<string, string>;
  detached?: boolean;
  shell?: boolean | string;
}

export interface StreamCallbacks {
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
  onError?: (err: Error) => void;
  onExit?: (code: number, signal?: string | null) => void;
}

export interface IProcessHandle {
  pid?: number;
  kill(signal?: string): Promise<void>;
  wait(): Promise<ProcessResult>;
}

export interface IProcessRunner {
  exec(command: string, args: string[], options?: ProcessOptions): Promise<ProcessResult>;
  spawnStream(
    command: string,
    args: string[],
    callbacks?: StreamCallbacks,
    options?: ProcessOptions
  ): IProcessHandle;
}

export interface MockProcessResponse {
  stdoutChunks?: string[];
  stderrChunks?: string[];
  exitCode?: number;
  delayMs?: number;
  spawnError?: Error;
}

export interface MockResponseRule {
  id?: string;
  match: (command: string, args: string[]) => boolean;
  response: MockProcessResponse | ((command: string, args: string[]) => MockProcessResponse);
  times?: number;
  matcher?: string | RegExp | ((command: string, args: string[]) => boolean);
}

export interface ProcessInvocation {
  command: string;
  args: string[];
  options?: ProcessOptions;
  timestamp: number;
}
