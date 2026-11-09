/**
 * src/engine/queue/types.ts
 * Core types and event interfaces for DownloadQueueEngine.
 */

import type { IProcessRunner } from '../runner/types';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'done'
  | 'error'
  | 'cancelled';

export interface ProgressMetrics {
  percent: number;          // 0.0 - 100.0
  speed: string;            // Formatted e.g. "2.50 MiB/s"
  speedBps: number;         // Raw bytes per second
  eta: string;              // Formatted e.g. "01:45"
  etaSeconds: number;       // Raw seconds
  totalBytes: number;       // Total size in bytes
  downloadedBytes: number;  // Downloaded bytes so far
}

export interface DownloadProgress extends ProgressMetrics {
  id: string;
  status: DownloadStatus;
  filePath?: string;
  error?: string;
}

export interface ClipSegment {
  start: number;            // Start offset in seconds
  end: number;              // End offset in seconds
  name?: string;
}

export interface QueueItemOptions {
  id: string;
  url: string;
  title?: string;
  outputPath?: string;
  format?: string;
  videoFormat?: string;
  audioFormat?: 'mp3' | 'm4a' | 'flac' | 'wav' | 'opus' | 'aac' | string;
  audioQuality?: number;    // 0 (best) - 9 (smallest)
  clips?: ClipSegment[];
  extractAudio?: boolean;
  isPlaylist?: boolean;
  priority?: number;        // Higher number = earlier execution (default 0)
  customArgs?: string[];
  cleanPartialOnCancel?: boolean;
}

export interface QueueEngineStatus {
  active: number;
  queued: number;
  paused: number;
  done: number;
  error: number;
  cancelled: number;
  total: number;
}

export type QueueStatus = QueueEngineStatus;

export interface QueueEngineOptions {
  runner?: IProcessRunner;
  concurrency?: number;     // 1 to 8, default: 3
  binaryPath?: string;      // default: 'yt-dlp'
  ffmpegPath?: string;
  argsBuilder?: (opts: QueueItemOptions, isResume: boolean) => string[];
  progressParser?: (chunk: string, totalDuration?: number) => Partial<ProgressMetrics> | null;

  // Legacy / Direct Callbacks
  onProgress?: (id: string, progress: DownloadProgress) => void;
  onDone?: (id: string, filePath: string) => void;
  onError?: (id: string, message: string) => void;
  onStateChange?: (id: string, oldState: DownloadStatus, newState: DownloadStatus) => void;
}

export interface QueueEvents {
  'item:added': (item: QueueItemSnapshot) => void;
  'item:started': (item: QueueItemSnapshot) => void;
  'item:progress': (id: string, progress: DownloadProgress) => void;
  'item:paused': (id: string, progress: DownloadProgress) => void;
  'item:resumed': (id: string) => void;
  'item:done': (id: string, filePath: string) => void;
  'item:error': (id: string, error: string) => void;
  'item:cancelled': (id: string) => void;
  'item:removed': (id: string) => void;
  'queue:drained': () => void;
  'queue:status': (status: QueueStatus) => void;
  'concurrency:changed': (newLimit: number) => void;
}

export interface QueueItemSnapshot {
  id: string;
  status: DownloadStatus;
  progress: DownloadProgress;
  options: QueueItemOptions;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  isResumed: boolean;
}
