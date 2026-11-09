/**
 * src/engine/parser/types.ts
 * Type definitions for stream progress, destination extraction, and error classification.
 */

export interface ProgressUpdate {
  percent: number;
  speed: string | null;
  speedBps: number | null;
  eta: string | null;
  etaSeconds: number | null;
  totalBytes: number | null;
  downloadedBytes: number | null;
}

export type StreamStage =
  | 'download'
  | 'transcode'
  | 'merge'
  | 'extract_audio'
  | 'remux'
  | 'complete';

export interface StreamProgressUpdate extends ProgressUpdate {
  stage?: StreamStage;
  frame?: number | null;
  fps?: number | null;
  bitrate?: string | null;
  speedMultiplier?: number | null;
  destinationPath?: string | null;
  rawLine?: string;
}

export interface ParseProgressOptions {
  totalDurationSeconds?: number;
  allowFfmpegWithoutDuration?: boolean;
  fallbackStage?: StreamStage;
}

export type ErrorCategory =
  | 'network'
  | 'video_unavailable'
  | 'private_video'
  | 'age_restricted'
  | 'format_unavailable'
  | 'geo_restricted'
  | 'disk_space'
  | 'permission_denied'
  | 'tool_missing'
  | 'unknown';

export interface ParsedError {
  category: ErrorCategory;
  isTransient: boolean;
  userMessage: string;
  rawMessage: string;
  videoId?: string;
  exitCode?: number;
}

export type DestinationOperation =
  | 'download'
  | 'already_downloaded'
  | 'merge'
  | 'extract_audio'
  | 'remux'
  | 'move'
  | 'fixup';

export interface DestinationInfo {
  filePath: string;
  operation: DestinationOperation;
  isFinal: boolean;
}
