/**
 * src/engine/queue/item.ts
 * Single download lifecycle controller with process handle management and progress caching.
 */

import type { IProcessRunner, IProcessHandle } from '../runner/types';
import { parseProgress } from '../parser/progress';
import { extractDestinationPath } from '../parser/destination';
import type {
  QueueItemOptions,
  DownloadStatus,
  DownloadProgress,
  QueueItemSnapshot,
  ProgressMetrics,
} from './types';

export interface ItemCallbacks {
  onProgress: (progress: DownloadProgress) => void;
  onDone: (filePath: string) => void;
  onError: (error: string) => void;
  onStateChange: (oldState: DownloadStatus, newState: DownloadStatus) => void;
}

export class QueueItem {
  public readonly id: string;
  public readonly options: QueueItemOptions;
  public readonly createdAt: number;
  public startedAt?: number;
  public completedAt?: number;
  public isResumed = false;

  private _status: DownloadStatus = 'queued';
  private _handle: IProcessHandle | null = null;
  private _intent: 'pause' | 'cancel' | null = null;
  private _filePath = '';
  private _errorMessage = '';
  private _lastProgress: ProgressMetrics;

  constructor(options: QueueItemOptions) {
    this.id = options.id;
    this.options = { ...options, priority: options.priority ?? 0 };
    this.createdAt = Date.now();
    this._lastProgress = {
      percent: 0,
      speed: '',
      speedBps: 0,
      eta: '',
      etaSeconds: 0,
      totalBytes: 0,
      downloadedBytes: 0,
    };
  }

  get status(): DownloadStatus {
    return this._status;
  }

  get filePath(): string {
    return this._filePath;
  }

  get errorMessage(): string {
    return this._errorMessage;
  }

  get progress(): DownloadProgress {
    return {
      ...this._lastProgress,
      id: this.id,
      status: this._status,
      filePath: this._filePath || undefined,
      error: this._errorMessage || undefined,
    };
  }

  toSnapshot(): QueueItemSnapshot {
    return {
      id: this.id,
      status: this._status,
      progress: this.progress,
      options: { ...this.options },
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      isResumed: this.isResumed,
    };
  }

  private setStatus(newStatus: DownloadStatus, callbacks?: ItemCallbacks): void {
    const oldStatus = this._status;
    if (oldStatus === newStatus) return;
    this._status = newStatus;
    callbacks?.onStateChange(oldStatus, newStatus);
  }

  start(
    runner: IProcessRunner,
    binaryPath: string,
    args: string[],
    callbacks: ItemCallbacks,
    progressParser?: (chunk: string, totalDuration?: number) => Partial<ProgressMetrics> | null
  ): Promise<string> {
    if (this._status === 'downloading') {
      return Promise.reject(new Error(`Item ${this.id} is already downloading`));
    }

    this.startedAt = this.startedAt ?? Date.now();
    this._intent = null;
    this.setStatus('downloading', callbacks);

    const clipDuration =
      this.options.clips && this.options.clips.length === 1
        ? Math.max(0, this.options.clips[0].end - this.options.clips[0].start)
        : undefined;

    return new Promise<string>((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        this._handle = null;
      };

      const handleChunk = (chunk: string) => {
        if (this._status !== 'downloading') return;

        // Sniff destination path
        const newDest = extractDestinationPath(chunk, this._filePath);
        if (newDest) {
          this._filePath = newDest;
        }

        // Sniff progress
        const parsed = progressParser
          ? progressParser(chunk, clipDuration)
          : parseProgress(chunk, clipDuration);

        if (parsed) {
          this.updateProgress(
            {
              percent: parsed.percent,
              speed: parsed.speed || '',
              speedBps: parsed.speedBps || 0,
              eta: parsed.eta || '',
              etaSeconds: parsed.etaSeconds || 0,
              totalBytes: parsed.totalBytes || 0,
              downloadedBytes: parsed.downloadedBytes || 0,
            },
            callbacks
          );
        }
      };

      this._handle = runner.spawnStream(binaryPath, args, {
        onStdoutChunk: (chunk: string) => {
          handleChunk(chunk);
        },
        onStderrChunk: (chunk: string) => {
          handleChunk(chunk);
        },
        onError: (err: Error) => {
          cleanup();
          if (this._intent === 'pause' || this._intent === 'cancel') return;
          this._errorMessage = err.message;
          this.setStatus('error', callbacks);
          callbacks.onError(err.message);
          if (!resolved) {
            resolved = true;
            reject(err);
          }
        },
        onExit: (code: number) => {
          cleanup();

          if (this._intent === 'pause') {
            this.setStatus('paused', callbacks);
            if (!resolved) {
              resolved = true;
              resolve(this._filePath);
            }
            return;
          }

          if (this._intent === 'cancel') {
            this.setStatus('cancelled', callbacks);
            if (!resolved) {
              resolved = true;
              resolve(this._filePath);
            }
            return;
          }

          if (code === 0) {
            this.completedAt = Date.now();
            this._lastProgress.percent = 100;
            this.setStatus('done', callbacks);
            const resultPath = this._filePath || this.options.outputPath || '';
            callbacks.onDone(resultPath);
            if (!resolved) {
              resolved = true;
              resolve(resultPath);
            }
          } else {
            const msg = `Download process exited with code ${code}`;
            this._errorMessage = msg;
            this.setStatus('error', callbacks);
            callbacks.onError(msg);
            if (!resolved) {
              resolved = true;
              reject(new Error(msg));
            }
          }
        },
      });
    });
  }

  updateProgress(metrics: Partial<ProgressMetrics>, callbacks?: ItemCallbacks): void {
    if (this._status !== 'downloading') return;

    // Enforce monotonic non-decreasing percent
    const percent = Math.max(
      this._lastProgress.percent,
      metrics.percent !== undefined && !isNaN(metrics.percent)
        ? metrics.percent
        : this._lastProgress.percent
    );

    this._lastProgress = {
      percent,
      speed:
        metrics.speed !== undefined && metrics.speed !== null
          ? metrics.speed
          : this._lastProgress.speed,
      speedBps:
        metrics.speedBps !== undefined && metrics.speedBps !== null
          ? metrics.speedBps
          : this._lastProgress.speedBps,
      eta:
        metrics.eta !== undefined && metrics.eta !== null
          ? metrics.eta
          : this._lastProgress.eta,
      etaSeconds:
        metrics.etaSeconds !== undefined && metrics.etaSeconds !== null
          ? metrics.etaSeconds
          : this._lastProgress.etaSeconds,
      totalBytes:
        metrics.totalBytes !== undefined && metrics.totalBytes !== null
          ? metrics.totalBytes
          : this._lastProgress.totalBytes,
      downloadedBytes:
        metrics.downloadedBytes !== undefined && metrics.downloadedBytes !== null
          ? metrics.downloadedBytes
          : this._lastProgress.downloadedBytes,
    };

    callbacks?.onProgress(this.progress);
  }

  async pause(): Promise<void> {
    if (
      this._status === 'paused' ||
      this._status === 'done' ||
      this._status === 'cancelled'
    ) {
      return;
    }

    if (this._status === 'queued') {
      this._status = 'paused';
      return;
    }

    if (this._handle) {
      this._intent = 'pause';
      // Graceful termination: SIGTERM first to preserve .part file
      await this._handle.kill('SIGTERM');
    } else {
      this._status = 'paused';
    }
  }

  async cancel(): Promise<void> {
    if (this._status === 'cancelled') return;

    if (this._handle) {
      this._intent = 'cancel';
      // Fast termination
      await this._handle.kill('SIGKILL');
    } else {
      this._status = 'cancelled';
    }
  }

  prepareForResume(): void {
    this.isResumed = true;
    this._intent = null;
    this._errorMessage = '';
    this._status = 'queued';
  }

  prepareForRetry(): void {
    this.isResumed = false;
    this._intent = null;
    this._errorMessage = '';
    this._filePath = '';
    this._lastProgress = {
      percent: 0,
      speed: '',
      speedBps: 0,
      eta: '',
      etaSeconds: 0,
      totalBytes: 0,
      downloadedBytes: 0,
    };
    this._status = 'queued';
  }
}
