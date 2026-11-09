/**
 * src/engine/runner/index.ts
 * Module entry point and Dependency Injection container for process runners.
 */

import { RealProcessRunner } from './real';
import { MockProcessRunner } from './mock';
import type { IProcessRunner } from './types';

export * from './types';
export * from './real';
export * from './mock';

let activeRunner: IProcessRunner = new RealProcessRunner();

export function getProcessRunner(): IProcessRunner {
  return activeRunner;
}

export function setProcessRunner(runner: IProcessRunner): void {
  activeRunner = runner;
}

export function createProcessRunner(type: 'real' | 'mock' = 'real'): IProcessRunner {
  return type === 'real' ? new RealProcessRunner() : new MockProcessRunner();
}
