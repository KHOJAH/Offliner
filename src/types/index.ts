// src/types/index.ts

// === IPC Types ===

export interface CommandMessage {
  type: 'command';
  id: string;
  action: 'download' | 'cancel' | 'pause' | 'resume' | 'metadata';
  args: Record<string, unknown>;
}

export interface EventMessage {
  type: 'event';
  action: 'progress' | 'done' | 'error' | 'metadata';
  downloadId?: string;
  percent?: number;
  speed?: string;
  speedBps?: number;
  eta?: string;
  etaSeconds?: number;
  totalBytes?: number;
  downloadedBytes?: number;
  filePath?: string;
  message?: string;
  data?: Record<string, unknown>;
}

// === Download Types ===

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  description?: string;
  duration: number; // seconds
  thumbnail: string;
  uploader: string;
  upload_date?: string;
  view_count?: number;
  formats: FormatInfo[];
  is_playlist: boolean;
  playlist_count?: number;
  entries?: VideoMetadata[]; // for playlists
}

export interface FormatInfo {
  format_id: string;
  ext: string;
  resolution: string; // e.g. "1920x1080" or "audio only"
  filesize?: number;
  vcodec?: string;
  acodec?: string;
  abr?: number; // audio bitrate
  vbr?: number; // video bitrate
  fps?: number;
  note?: string;
}

export interface ClipRange {
  name: string;
  start: number; // seconds
  end: number; // seconds
}

export interface DownloadConfig {
  url: string;
  format?: string;
  audioFormat?: string;
  audioQuality?: number;
  clips?: ClipRange[];
  outputPath?: string;
  isPlaylist?: boolean;
}

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'done' | 'error' | 'cancelled';

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  status: DownloadStatus;
  progress: number; // 0-100
  speed?: string;
  speedBps?: number;
  eta?: string;
  etaSeconds?: number;
  totalBytes?: number;
  downloadedBytes?: number;
  config: DownloadConfig;
  filePath?: string;
  errorMessage?: string;
  createdAt: number;
  completedAt?: number;
}

export interface QueueStatus {
  active: number;
  queued: number;
  completed: number;
  failed: number;
}

// === Settings Types ===

export interface Settings {
  downloadPath: string;
  defaultVideoFormat: string;
  defaultAudioFormat: string;
  defaultQuality: string;
  concurrency: number;
  autoUpdate: boolean;
  theme: 'light' | 'dark' | 'glass';
  maxClipDuration: number; // seconds, default 3600
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

// === UI Types ===

export interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number; // ms, default 5000
}
