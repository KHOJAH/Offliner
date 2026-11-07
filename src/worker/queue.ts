// src/worker/queue.ts
/**
 * Modernized backwards-compatible adapter delegating to DownloadQueueEngine.
 */

import { DownloadQueueEngine } from '../engine/queue/queue';
import type { QueueItemOptions } from '../engine/queue/types';
import type { YtDlpOptions } from './ytdlp';
import type { ProgressUpdate } from './progress-parser';
import type { IProcessRunner } from '../engine/runner/types';
import { sanitizePath, ensureDirExists } from './fs-utils';

export interface QueueOptions {
  concurrency: number;
  onProgress: (downloadId: string, update: ProgressUpdate) => void;
  onDone: (downloadId: string, filePath: string) => void;
  onError: (downloadId: string, message: string) => void;
  runner?: IProcessRunner;
}

export class DownloadQueue {
  private engine: DownloadQueueEngine;
  private options: QueueOptions;

  constructor(options: QueueOptions) {
    this.options = options;
    this.engine = new DownloadQueueEngine({
      concurrency: options.concurrency,
      runner: options.runner,
      onProgress: (id, progress) => {
        options.onProgress(id, {
          percent: progress.percent,
          speed: progress.speed || null,
          speedBps: progress.speedBps || null,
          eta: progress.eta || null,
          etaSeconds: progress.etaSeconds || null,
          totalBytes: progress.totalBytes || null,
          downloadedBytes: progress.downloadedBytes || null,
        });
      },
      onDone: (id, filePath) => {
        const sanitized = sanitizePath(filePath || '');
        if (sanitized) {
          ensureDirExists(sanitized);
        }
        options.onDone(id, sanitized || filePath);
      },
      onError: (id, message) => {
        options.onError(id, message);
      },
    });
  }

  async addDownload(id: string, opts: YtDlpOptions, url: string): Promise<void> {
    const itemOpts: QueueItemOptions = {
      id,
      url,
      format: opts.format,
      videoFormat: opts.videoFormat,
      outputPath: opts.outputPath,
      audioFormat: opts.audioFormat,
      audioQuality: opts.audioQuality,
      clips: opts.clips,
      extractAudio: opts.extractAudio,
      isPlaylist: opts.isPlaylist,
    };
    await this.engine.add(itemOpts);
  }

  cancel(id: string): void {
    this.engine.cancel(id).catch(() => {});
  }

  pause(id: string): void {
    this.engine.pause(id).catch(() => {});
  }

  resume(id: string, fallbackOpts?: YtDlpOptions, fallbackUrl?: string): void {
    const item = this.engine.getItem(id);
    if (item) {
      this.engine.resume(id).catch(() => {});
    } else if (fallbackOpts && fallbackUrl) {
      this.addDownload(id, fallbackOpts, fallbackUrl).catch(() => {});
    }
  }

  cancelAll(): void {
    this.engine.cancelAll().catch(() => {});
  }

  getStatus(): { active: number; queued: number } {
    const status = this.engine.getStatus();
    return {
      active: status.active,
      queued: status.queued,
    };
  }

  getEngine(): DownloadQueueEngine {
    return this.engine;
  }
}
