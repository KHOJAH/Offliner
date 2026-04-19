// src/worker/queue.ts
import { YtDlp, YtDlpOptions } from './ytdlp';
import type { ProgressUpdate } from './progress-parser';
import { sanitizePath, ensureDirExists } from './fs-utils';

interface ActiveDownload {
  id: string;
  opts: YtDlpOptions;
  ytdlp: YtDlp;
  cancelled: boolean;
  paused: boolean;
}

export interface QueueOptions {
  concurrency: number;
  onProgress: (downloadId: string, update: ProgressUpdate) => void;
  onDone: (downloadId: string, filePath: string) => void;
  onError: (downloadId: string, message: string) => void;
}

export class DownloadQueue {
  private active: Map<string, ActiveDownload> = new Map();
  private pending: Array<{ id: string; opts: YtDlpOptions; url: string }> = [];
  private pausedIds: Set<string> = new Set();
  private options: QueueOptions;

  constructor(options: QueueOptions) {
    this.options = options;
  }

  async addDownload(id: string, opts: YtDlpOptions, url: string): Promise<void> {
    this.pausedIds.delete(id);
    if (this.active.size < this.options.concurrency) {
      this.startDownload(id, opts);
    } else {
      this.pending.push({ id, opts, url });
    }
  }

  private startDownload(id: string, opts: YtDlpOptions): void {
    const ytdlp = new YtDlp();
    const download: ActiveDownload = { id, opts, ytdlp, cancelled: false, paused: false };
    this.active.set(id, download);

    const onProgress = (update: ProgressUpdate) => {
      if (!download.cancelled && !download.paused) {
        this.options.onProgress(id, update);
      }
    };

    ytdlp
      .startDownload(opts, onProgress)
      .then((filePath) => {
        if (!download.cancelled && !download.paused) {
          const sanitized = sanitizePath(filePath || '');
          if (sanitized) {
             ensureDirExists(sanitized);
          }
          this.options.onDone(id, sanitized);
        }
      })
      .catch((err) => {
        if (!download.cancelled && !download.paused) {
          this.options.onError(id, err.message);
        }
      })
      .finally(() => {
        this.active.delete(id);
        this.processPending();
      });
  }

  private processPending(): void {
    if (this.active.size >= this.options.concurrency) return;

    // Find the first pending item that is NOT paused
    const nextIndex = this.pending.findIndex(p => !this.pausedIds.has(p.id));
    if (nextIndex !== -1) {
      const next = this.pending.splice(nextIndex, 1)[0];
      this.startDownload(next.id, next.opts);
    }
  }

  cancel(id: string): void {
    this.pausedIds.delete(id);
    const download = this.active.get(id);
    if (download) {
      download.cancelled = true;
      download.ytdlp.kill();
      this.active.delete(id);
      this.processPending();
    } else {
      // Remove from pending
      this.pending = this.pending.filter((p) => p.id !== id);
    }
  }

  pause(id: string): void {
    const download = this.active.get(id);
    if (download) {
      this.pausedIds.add(id);
      download.paused = true;
      download.ytdlp.kill();
      // Keep in active map but move to front of pending
      this.active.delete(id);
      this.pending.unshift({ id: download.id, opts: download.opts, url: download.opts.url });
    }
  }

  resume(id: string, fallbackOpts?: YtDlpOptions, fallbackUrl?: string): void {
    console.error(`[worker] Resume requested for ID: ${id}`);
    this.pausedIds.delete(id);

    // If already active, do nothing
    if (this.active.has(id)) {
      console.error(`[worker] ID ${id} is already active, ignoring resume`);
      return;
    }

    const pendingIndex = this.pending.findIndex((p) => p.id === id);
    if (pendingIndex !== -1) {
      console.error(`[worker] ID ${id} found in pending, starting now`);
      const next = this.pending.splice(pendingIndex, 1)[0];
      if (this.active.size < this.options.concurrency) {
        this.startDownload(next.id, next.opts);
      } else {
        // Move to front of queue to prioritize resume
        this.pending.unshift(next);
      }
    } else if (fallbackOpts && fallbackUrl) {
      console.error(`[worker] ID ${id} not in pending, using fallback options. URL: ${fallbackUrl}`);
      if (this.active.size < this.options.concurrency) {
        this.startDownload(id, fallbackOpts);
      } else {
        console.error(`[worker] Concurrency limit reached, adding to front of pending`);
        this.pending.unshift({ id, opts: fallbackOpts, url: fallbackUrl });
      }
    } else {
      console.error(`[worker] ID ${id} not found in pending and no fallback options provided! FallbackOpts: ${!!fallbackOpts}, FallbackUrl: ${fallbackUrl}`);
    }
  }

  cancelAll(): void {
    for (const download of this.active.values()) {
      download.cancelled = true;
      download.ytdlp.kill();
    }
    this.active.clear();
    this.pending = [];
  }

  getStatus(): { active: number; queued: number } {
    return {
      active: this.active.size,
      queued: this.pending.length,
    };
  }
}
