/**
 * src/types/engine.ts
 * Re-export of process engine runner types for global type resolution.
 */

export type {
  ProcessResult,
  ProcessOptions,
  StreamCallbacks,
  IProcessHandle,
  IProcessRunner,
  MockProcessResponse,
  MockResponseRule,
  ProcessInvocation,
} from '../engine/runner/types';
