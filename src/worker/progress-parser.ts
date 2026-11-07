// src/worker/progress-parser.ts
/**
 * Backwards compatibility proxy re-exporting unified engine parser.
 */

export type { ProgressUpdate } from '../engine/parser/types';
export {
  parseProgress,
  parseSizeToBytes,
} from '../engine/parser/progress';
