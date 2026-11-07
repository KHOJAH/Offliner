/**
 * src/engine/queue/queue.ts
 * High-performance, decoupled concurrency queue engine with dynamic bounds (1-8),
 * batch operations, priority scheduling, and full state machine transitions.
 */

import { EventEmitter } from 'events';
import { getProcessRunner } from '../runner';
import type { IProcessRunner } from '../runner/types';
import { buildDownloadArgs } from '../ytdlp/builder';
import { QueueItem } from './item';
import type {
  QueueEngineOptions,
  QueueItemOptions,
  QueueStatus,
  DownloadStatus,
  DownloadProgress,
  QueueItemSnapshot,
  ProgressMetrics,
} from './types';

export class DownloadQueueEngine extends EventEmitter {
  private items: Map<string, QueueItem> = new Map();
  private active: Map<string, QueueItem> = new Map();
  private pending: QueueItem[] = [];
  private paused: Set<string> = new Set();

  private runner: IProcessRunner;
  private concurrency: number;
  private binaryPath: string;
  private ffmpegPath?: string;
  private argsBuilder?: (opts: QueueItemOptions, isResume: boolean) => string[];
  private progressParser?: (chunk: string, duration?: number) => Partial<ProgressMetrics> | null;
  private options: QueueEngineOptions;

  constructor(options: QueueEngineOptions = {}) {
    super();
    this.options = options;
    this.runner = options.runner ?? getProcessRunner();
    this.concurrency = this.clampConcurrency(options.concurrency ?? 3);
    this.binaryPath = options.binaryPath ?? 'yt-dlp';
    this.ffmpegPath = options.ffmpegPath;
    this.argsBuilder = options.argsBuilder;
    this.progressParser = options.progressParser;
  }

  private clampConcurrency(val: number): number {
    if (typeof val !== 'number' || isNaN(val)) return 3;
    return Math.max(1, Math.min(8, Math.floor(val)));
  }

  // === Concurrency Control ===

  getConcurrency(): number {
    return this.concurrency;
  }

  setConcurrency(limit: number): void {
    const clamped = this.clampConcurrency(limit);
    if (clamped === this.concurrency) return;

    const oldLimit = this.concurrency;
    this.concurrency = clamped;
    this.emit('concurrency:changed', this.concurrency);

    if (this.concurrency > oldLimit) {
      // Slot capacity increased: drain pending immediately
      this.processPending();
    }
    // If decreased: soft ramp down (active downloads finish naturally)
  }

  // === Item Ingestion ===

  async add(itemOptions: QueueItemOptions): Promise<QueueItemSnapshot> {
    const existing = this.items.get(itemOptions.id);
    if (existing) {
      if (existing.status === 'downloading' || existing.status === 'queued') {
        return existing.toSnapshot();
      }
      this.items.delete(itemOptions.id);
      this.pending = this.pending.filter((p) => p.id !== itemOptions.id);
      this.paused.delete(itemOptions.id);
    }

    const item = new QueueItem(itemOptions);
    this.items.set(item.id, item);

    // Insert into pending based on priority (descending priority, FIFO within same priority)
    this.enqueuePending(item);

    this.emit('item:added', item.toSnapshot());
    this.emitStatus();

    this.processPending();
    return item.toSnapshot();
  }

  private enqueuePending(item: QueueItem, prioritizeHead = false): void {
    if (prioritizeHead) {
      this.pending.unshift(item);
      return;
    }

    const priority = item.options.priority ?? 0;
    const index = this.pending.findIndex((p) => (p.options.priority ?? 0) < priority);
    if (index === -1) {
      this.pending.push(item);
    } else {
      this.pending.splice(index, 0, item);
    }
  }

  // === Scheduling & Concurrency Loop ===

  private processPending(): void {
    if (this.active.size >= this.concurrency) return;

    // Prune stale non-pending items from pending array
    this.pending = this.pending.filter(
      (item) => item.status === 'queued' || item.status === 'paused'
    );

    // Search for first non-paused queued item in pending queue
    const nextIdx = this.pending.findIndex(
      (item) => !this.paused.has(item.id) && item.status === 'queued'
    );

    if (nextIdx === -1) {
      if (this.active.size === 0 && this.pending.length === 0) {
        this.emit('queue:drained');
      }
      return;
    }

    const item = this.pending.splice(nextIdx, 1)[0];
    this.startItem(item);

    // Continue filling slots up to concurrency
    if (this.active.size < this.concurrency && this.pending.length > 0) {
      this.processPending();
    }
  }

  private startItem(item: QueueItem): void {
    this.active.set(item.id, item);
    this.emit('item:started', item.toSnapshot());
    this.emitStatus();

    const callbacks = {
      onProgress: (progress: DownloadProgress) => {
        this.options.onProgress?.(item.id, progress);
        this.emit('item:progress', item.id, progress);
      },
      onDone: (filePath: string) => {
        this.options.onDone?.(item.id, filePath);
        this.emit('item:done', item.id, filePath);
      },
      onError: (errMsg: string) => {
        this.options.onError?.(item.id, errMsg);
        this.emit('item:error', item.id, errMsg);
      },
      onStateChange: (oldState: DownloadStatus, newState: DownloadStatus) => {
        this.options.onStateChange?.(item.id, oldState, newState);
      },
    };

    try {
      const args = this.buildArgs(item.options, item.isResumed);

      item
        .start(
          this.runner,
          this.binaryPath,
          args,
          callbacks,
          this.progressParser
        )
        .catch(() => {
          // Errors are already handled via callbacks & state
        })
        .finally(() => {
          this.active.delete(item.id);
          this.emitStatus();
          this.processPending();
        });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      item.fail(errMsg, callbacks);
      this.active.delete(item.id);
      this.emitStatus();
      this.processPending();
    }
  }

  private buildArgs(opts: QueueItemOptions, isResume: boolean): string[] {
    if (this.argsBuilder) {
      return this.argsBuilder(opts, isResume);
    }

    return buildDownloadArgs(
      {
        url: opts.url,
        format: opts.format,
        videoFormat: opts.videoFormat,
        outputPath: opts.outputPath,
        audioFormat: opts.audioFormat,
        audioQuality: opts.audioQuality,
        clips: opts.clips,
        extractAudio: opts.extractAudio,
        isPlaylist: opts.isPlaylist,
        continueDownload: isResume,
        extraArgs: opts.customArgs,
      },
      {
        ffmpegPath: this.ffmpegPath,
      }
    );
  }

  // === Single Item Lifecycle Actions ===

  async pause(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.status === 'cancelled' || item.status === 'done' || item.status === 'error') {
      return false;
    }

    this.paused.add(id);

    if (this.active.has(id)) {
      this.active.delete(id);
      await item.pause();

      // Guard against concurrent cancellation during await item.pause()
      if ((item.status as DownloadStatus) === 'cancelled' || !this.items.has(id)) {
        this.paused.delete(id);
        return false;
      }

      // Place at head of pending queue for prioritized resumption
      this.pending.unshift(item);
      this.emit('item:paused', id, item.progress);
      this.emitStatus();
      this.processPending();
      return true;
    }

    if (item.status === 'queued') {
      await item.pause();
      if ((item.status as DownloadStatus) === 'cancelled' || !this.items.has(id)) {
        this.paused.delete(id);
        return false;
      }
      this.emit('item:paused', id, item.progress);
      this.emitStatus();
      return true;
    }

    return false;
  }

  async resume(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || item.status !== 'paused') return false;

    this.paused.delete(id);
    item.prepareForResume();

    // Prioritize resumed items at head of queue
    const pendingIdx = this.pending.findIndex((p) => p.id === id);
    if (pendingIdx !== -1) {
      this.pending.splice(pendingIdx, 1);
    }
    this.pending.unshift(item);

    this.emit('item:resumed', id);
    this.emitStatus();
    this.processPending();
    return true;
  }

  async cancel(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) return false;

    this.paused.delete(id);

    if (this.active.has(id)) {
      this.active.delete(id);
      await item.cancel();
      this.emit('item:cancelled', id);
      this.emitStatus();
      this.processPending();
      return true;
    }

    // Remove from pending if present
    this.pending = this.pending.filter((p) => p.id !== id);
    await item.cancel();
    this.emit('item:cancelled', id);
    this.emitStatus();
    this.processPending();
    return true;
  }

  async retry(id: string): Promise<boolean> {
    const item = this.items.get(id);
    if (!item || (item.status !== 'error' && item.status !== 'cancelled')) return false;

    item.prepareForRetry();
    this.paused.delete(id);
    this.enqueuePending(item);
    this.emitStatus();
    this.processPending();
    return true;
  }

  remove(id: string): boolean {
    const item = this.items.get(id);
    if (!item) return false;

    if (item.status === 'downloading') {
      item.cancel().catch(() => {});
      this.active.delete(id);
    }

    this.pending = this.pending.filter((p) => p.id !== id);
    this.paused.delete(id);
    this.items.delete(id);

    this.emit('item:removed', id);
    this.emitStatus();
    this.processPending();
    return true;
  }

  // === Batch Operations ===

  async pauseAll(): Promise<void> {
    // 1. Mark all active and queued items as paused immediately so processPending cannot pick them up
    for (const item of this.items.values()) {
      if (item.status === 'downloading' || item.status === 'queued') {
        this.paused.add(item.id);
      }
    }

    const activeItems = Array.from(this.active.values());
    this.active.clear();

    for (const item of activeItems) {
      await item.pause();
      if (item.status === 'cancelled' || !this.items.has(item.id)) {
        continue;
      }
      this.pending.unshift(item);
      this.emit('item:paused', item.id, item.progress);
    }

    // Mark all pending as paused
    for (const item of this.pending) {
      if (item.status === 'queued') {
        await item.pause();
        this.emit('item:paused', item.id, item.progress);
      }
    }

    // Purge any items from this.paused that were cancelled or removed concurrently
    for (const id of this.paused) {
      const it = this.items.get(id);
      if (!it || it.status !== 'paused') {
        this.paused.delete(id);
      }
    }

    this.emitStatus();
  }

  async resumeAll(): Promise<void> {
    this.paused.clear();
    for (const item of this.items.values()) {
      if (item.status === 'paused') {
        item.prepareForResume();
        if (!this.pending.some((p) => p.id === item.id)) {
          this.pending.push(item);
        }
        this.emit('item:resumed', item.id);
      }
    }

    this.emitStatus();
    this.processPending();
  }

  async cancelAll(): Promise<void> {
    this.active.clear();
    this.pending = [];
    this.paused.clear();

    const cancellable = Array.from(this.items.values()).filter(
      (item) => item.status !== 'done' && item.status !== 'cancelled' && item.status !== 'error'
    );

    for (const item of cancellable) {
      await item.cancel();
      this.emit('item:cancelled', item.id);
    }

    this.paused.clear();
    this.emitStatus();
  }

  clearFinished(): string[] {
    const cleared: string[] = [];
    for (const [id, item] of this.items.entries()) {
      if (item.status === 'done' || item.status === 'error' || item.status === 'cancelled') {
        this.items.delete(id);
        cleared.push(id);
        this.emit('item:removed', id);
      }
    }

    if (cleared.length > 0) {
      this.emitStatus();
    }
    return cleared;
  }

  // === Status & Inspection ===

  getStatus(): QueueStatus {
    let paused = 0;
    let done = 0;
    let error = 0;
    let cancelled = 0;

    for (const item of this.items.values()) {
      if (item.status === 'paused') paused++;
      else if (item.status === 'done') done++;
      else if (item.status === 'error') error++;
      else if (item.status === 'cancelled') cancelled++;
    }

    return {
      active: this.active.size,
      queued: this.pending.filter((p) => !this.paused.has(p.id) && p.status === 'queued').length,
      paused,
      done,
      error,
      cancelled,
      total: this.items.size,
    };
  }

  private emitStatus(): void {
    this.emit('queue:status', this.getStatus());
  }

  getItem(id: string): QueueItemSnapshot | undefined {
    return this.items.get(id)?.toSnapshot();
  }

  getAllItems(): QueueItemSnapshot[] {
    return Array.from(this.items.values()).map((i) => i.toSnapshot());
  }

  getItemsByStatus(status: DownloadStatus): QueueItemSnapshot[] {
    return Array.from(this.items.values())
      .filter((i) => i.status === status)
      .map((i) => i.toSnapshot());
  }

  async destroy(): Promise<void> {
    await this.cancelAll();
    this.removeAllListeners();
  }
}
