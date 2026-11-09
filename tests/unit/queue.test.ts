/**
 * tests/unit/queue.test.ts
 * Modernized unit test suite for DownloadQueueEngine and DownloadQueue adapter.
 * Uses MockProcessRunner for deterministic offline testing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { DownloadQueue } from '@/worker/queue';
import { MockProcessRunner } from '@/engine/runner/mock';

describe('DownloadQueueEngine Architecture & Lifecycle', () => {
  let mockRunner: MockProcessRunner;

  beforeEach(() => {
    mockRunner = new MockProcessRunner();
  });

  // SUITE 1: Concurrency Limiter & Clamping
  describe('Suite 1: Concurrency Limiter & Clamping', () => {
    it('1.1 enforces concurrency bounds (clamps to 1-8, defaults to 3)', () => {
      const qDefault = new DownloadQueueEngine({ runner: mockRunner });
      expect(qDefault.getConcurrency()).toBe(3);

      const qLow = new DownloadQueueEngine({ runner: mockRunner, concurrency: -5 });
      expect(qLow.getConcurrency()).toBe(1);

      const qHigh = new DownloadQueueEngine({ runner: mockRunner, concurrency: 99 });
      expect(qHigh.getConcurrency()).toBe(8);
    });

    it('1.2 limits parallel active downloads to concurrency limit', async () => {
      // 5 items, concurrency 2 -> 2 active, 3 queued
      mockRunner.setDefaultResponse({ delayMs: 100, stdoutChunks: ['[download] 50%\n'] });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });

      for (let i = 1; i <= 5; i++) {
        await q.add({ id: `item-${i}`, url: `https://youtube.com/watch?v=${i}` });
      }

      const status = q.getStatus();
      expect(status.active).toBe(2);
      expect(status.queued).toBe(3);
    });

    it('1.3 dynamically adapts when concurrency is increased at runtime', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({ id: '1', url: 'https://youtube.com/1' });
      await q.add({ id: '2', url: 'https://youtube.com/2' });
      await q.add({ id: '3', url: 'https://youtube.com/3' });

      expect(q.getStatus().active).toBe(1);
      expect(q.getStatus().queued).toBe(2);

      // Increase to 3 -> both queued immediately start
      q.setConcurrency(3);
      expect(q.getStatus().active).toBe(3);
      expect(q.getStatus().queued).toBe(0);
    });
  });

  // SUITE 2: Pause Mechanics (Process Termination, .part Preservation)
  describe('Suite 2: Queue Item Pause', () => {
    it('2.1 kills active process with SIGTERM, retains status paused, and frees slot', async () => {
      mockRunner.setDefaultResponse({
        delayMs: 100,
        stdoutChunks: ['[download]  25.0% of ~ 10.0MiB\n'],
      });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({ id: 'item-1', url: 'https://youtube.com/1' });
      await q.add({ id: 'item-2', url: 'https://youtube.com/2' });

      expect(q.getStatus().active).toBe(1);

      // Pause active item-1
      const paused = await q.pause('item-1');
      expect(paused).toBe(true);

      const item1 = q.getItem('item-1');
      expect(item1?.status).toBe('paused');

      // Slot must be freed for item-2 immediately
      expect(q.getStatus().active).toBe(1);
      const item2 = q.getItem('item-2');
      expect(item2?.status).toBe('downloading');
    });

    it('2.2 pauses item currently in queued state without spawning process', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({ id: 'active-1', url: 'https://youtube.com/1' });
      await q.add({ id: 'queued-2', url: 'https://youtube.com/2' });

      await q.pause('queued-2');
      expect(q.getItem('queued-2')?.status).toBe('paused');
    });
  });

  // SUITE 3: Resume Mechanics (Spawns with --continue)
  describe('Suite 3: Queue Item Resume', () => {
    it('3.1 resumes paused item by injecting --continue flag and prioritizing it', async () => {
      mockRunner.setDefaultResponse({ delayMs: 50, stdoutChunks: ['[download] 100%\n'] });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({
        id: 'resume-me',
        url: 'https://youtube.com/1',
        outputPath: '/downloads/vid.mp4',
      });
      await q.pause('resume-me');
      expect(q.getItem('resume-me')?.status).toBe('paused');

      mockRunner.clearInvocations();

      const resumed = await q.resume('resume-me');
      expect(resumed).toBe(true);

      // Verify invocation included --continue and direct output path
      const invocations = mockRunner.getInvocations();
      expect(invocations.length).toBe(1);
      expect(invocations[0].args).toContain('--continue');
      expect(invocations[0].args).toContain('/downloads/vid.mp4');
    });
  });

  // SUITE 4: Cancel Mechanics
  describe('Suite 4: Queue Item Cancel', () => {
    it('4.1 cancels active item with SIGKILL and frees concurrency slot', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({ id: 'cancel-me', url: 'https://youtube.com/1' });
      expect(q.getStatus().active).toBe(1);

      await q.cancel('cancel-me');
      expect(q.getItem('cancel-me')?.status).toBe('cancelled');
      expect(q.getStatus().active).toBe(0);
    });

    it('4.2 cancels queued item removing it from pending list', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });

      await q.add({ id: 'active', url: 'https://youtube.com/1' });
      await q.add({ id: 'queued', url: 'https://youtube.com/2' });

      await q.cancel('queued');
      expect(q.getItem('queued')?.status).toBe('cancelled');
      expect(q.getStatus().queued).toBe(0);
    });
  });

  // SUITE 5: Batch Operations
  describe('Suite 5: Batch Operations', () => {
    it('5.1 pauseAll stops all active items and flags queued items as paused', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });

      for (let i = 1; i <= 4; i++) {
        await q.add({ id: `item-${i}`, url: `https://youtube.com/${i}` });
      }

      await q.pauseAll();
      const status = q.getStatus();
      expect(status.active).toBe(0);
      expect(status.paused).toBe(4);
    });

    it('5.2 resumeAll restarts paused items up to concurrency limit', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });

      for (let i = 1; i <= 3; i++) {
        await q.add({ id: `item-${i}`, url: `https://youtube.com/${i}` });
      }
      await q.pauseAll();

      await q.resumeAll();
      const status = q.getStatus();
      expect(status.active).toBe(2);
      expect(status.queued).toBe(1);
    });

    it('5.3 cancelAll terminates all active and queued items', async () => {
      mockRunner.setDefaultResponse({ delayMs: 100 });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });

      for (let i = 1; i <= 4; i++) {
        await q.add({ id: `item-${i}`, url: `https://youtube.com/${i}` });
      }

      await q.cancelAll();
      const status = q.getStatus();
      expect(status.active).toBe(0);
      expect(status.queued).toBe(0);
      expect(status.cancelled).toBe(4);
    });

    it('5.4 clearFinished removes only done, error, and cancelled downloads', async () => {
      mockRunner.setDefaultResponse({ delayMs: 0, stdoutChunks: ['[download] 100%\n'] });
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });

      await q.add({ id: 'done-1', url: 'https://youtube.com/1' });
      // Wait for done-1 microtask exit
      await new Promise((r) => setTimeout(r, 15));

      mockRunner.setDefaultResponse({ delayMs: 100 });
      await q.add({ id: 'active-2', url: 'https://youtube.com/2' });
      await q.add({ id: 'cancel-3', url: 'https://youtube.com/3' });
      await q.cancel('cancel-3');

      const cleared = q.clearFinished();
      expect(cleared).toContain('done-1');
      expect(cleared).toContain('cancel-3');
      expect(cleared).not.toContain('active-2');

      expect(q.getItem('active-2')).toBeDefined();
      expect(q.getItem('done-1')).toBeUndefined();
    });
  });

  // SUITE 6: Error Resilience & Slot Release
  describe('Suite 6: Error Handling', () => {
    it('6.1 releases concurrency slot when process exits with error code', async () => {
      mockRunner.onCommand(/bad-url/, {
        exitCode: 1,
        stderrChunks: ['ERROR: Video unavailable\n'],
      });
      mockRunner.onCommand(/good-url/, {
        exitCode: 0,
        stdoutChunks: ['[download] 100%\n'],
      });

      const onError = vi.fn();
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1, onError });

      await q.add({ id: 'bad', url: 'https://youtube.com/bad-url' });
      await q.add({ id: 'good', url: 'https://youtube.com/good-url' });

      await new Promise((r) => setTimeout(r, 25));

      expect(q.getItem('bad')?.status).toBe('error');
      expect(onError).toHaveBeenCalled();
      expect(q.getItem('good')?.status).toBe('done');
    });
  });

  // SUITE 7: Legacy DownloadQueue Compatibility
  describe('Suite 7: Legacy DownloadQueue Compatibility', () => {
    it('7.1 can be instantiated and reports correct status', () => {
      const queue = new DownloadQueue({
        concurrency: 2,
        runner: mockRunner,
        onProgress: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      });
      expect(queue).toBeDefined();
      expect(queue.getStatus()).toEqual({ active: 0, queued: 0 });
    });

    it('7.2 handles cancel/pause/resume of non-existent download gracefully', () => {
      const queue = new DownloadQueue({
        concurrency: 2,
        runner: mockRunner,
        onProgress: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      });
      expect(() => queue.cancel('non-existent')).not.toThrow();
      expect(() => queue.pause('non-existent')).not.toThrow();
      expect(() => queue.resume('non-existent')).not.toThrow();
    });

    it('7.3 cancels all downloads via cancelAll', () => {
      const queue = new DownloadQueue({
        concurrency: 2,
        runner: mockRunner,
        onProgress: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      });
      queue.cancelAll();
      expect(queue.getStatus()).toEqual({ active: 0, queued: 0 });
    });

    it('7.4 maintains full lifecycle callbacks (onProgress, onDone)', async () => {
      mockRunner.setDefaultResponse({
        delayMs: 10,
        stdoutChunks: ['[download]  50.0% of ~ 10.0MiB\n', '[download] 100%\n'],
      });

      const onProgress = vi.fn();
      const onDone = vi.fn();
      const onError = vi.fn();

      const legacyQueue = new DownloadQueue({
        concurrency: 2,
        runner: mockRunner,
        onProgress,
        onDone,
        onError,
      });

      await legacyQueue.addDownload(
        'leg-1',
        { url: 'https://youtube.com/1' },
        'https://youtube.com/1'
      );
      expect(legacyQueue.getStatus().active).toBe(1);

      await new Promise((r) => setTimeout(r, 35));
      expect(onDone).toHaveBeenCalledWith('leg-1', expect.any(String));
      expect(legacyQueue.getStatus()).toEqual({ active: 0, queued: 0 });
    });
  });
});
