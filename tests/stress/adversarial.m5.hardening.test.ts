// @vitest-environment jsdom
/**
 * tests/stress/adversarial.m5.hardening.test.ts
 * Milestone 5 Tier 5 Adversarial Coverage Hardening Suite:
 * White-box stress testing, race conditions, corrupt inputs, and state desynchronizations.
 * 18 high-impact adversarial tests across 4 cohesive suites.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useUIStore } from '@/renderer/stores/uiStore';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner } from '@/engine/runner/mock';
import { parseProgress, parseStreamProgress } from '@/engine/parser/progress';
import { parseError, isTransientError } from '@/engine/parser/error';
import ClipTimeline from '@/renderer/components/ClipTimeline';
import TimeInput from '@/renderer/components/TimeInput';
import DownloadCard from '@/renderer/components/DownloadCard';
import type { DownloadItem } from '@/types';

describe('Tier 5 Adversarial Coverage Hardening Suite (18 Tests)', () => {
  let unhandledRejections: any[] = [];
  let rejectionHandler: (err: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unhandledRejections = [];
    rejectionHandler = (event: any) => {
      const reason = event?.reason || event;
      unhandledRejections.push(reason);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', rejectionHandler);
    }
    process.on('unhandledRejection', rejectionHandler);

    // Setup pristine electronAPI mocks
    (window as any).electronAPI = {
      ...(window as any).electronAPI,
      saveDownloads: vi.fn().mockResolvedValue(undefined),
      loadDownloads: vi.fn().mockResolvedValue([]),
      fileExists: vi.fn().mockResolvedValue(true),
      deleteFile: vi.fn().mockResolvedValue(true),
      openFile: vi.fn().mockResolvedValue(undefined),
      showInFolder: vi.fn().mockResolvedValue(undefined),
      pauseDownload: vi.fn().mockResolvedValue(undefined),
      resumeDownload: vi.fn().mockResolvedValue(undefined),
      cancelDownload: vi.fn().mockResolvedValue(undefined),
      onDownloadProgress: vi.fn(),
      onDownloadDone: vi.fn(),
      onDownloadError: vi.fn(),
    };

    useDownloadStore.setState({ downloads: new Map() });
    useUIStore.setState({ toasts: [] });
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', rejectionHandler);
    }
    process.removeListener('unhandledRejection' as any, rejectionHandler);
  });

  // =========================================================================
  // SUITE 1: downloadStore State Machine & Out-of-Order IPC Hardening
  // =========================================================================
  describe('Suite 1: downloadStore State Machine & Out-of-Order IPC Hardening', () => {
    it('1.1 protects finished items against delayed progress packet corruption', () => {
      const { addDownload, updateProgress } = useDownloadStore.getState();

      const item: DownloadItem = {
        id: 'done-item-1',
        title: 'Completed Video',
        url: 'https://youtube.com/watch?v=done1',
        thumbnail: 'https://example.com/thumb.jpg',
        status: 'done',
        progress: 100,
        completedAt: 1700000000000,
        filePath: '/downloads/finished_video.mp4',
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=done1' },
      };
      addDownload(item);

      // Case A: Delayed progress event with status: 'downloading'
      updateProgress('done-item-1', {
        status: 'downloading',
        progress: 42,
        speed: '5.2 MB/s',
        eta: '01:00',
      });

      let stored = useDownloadStore.getState().downloads.get('done-item-1');
      expect(stored?.status).toBe('done');
      expect(stored?.progress).toBe(100);
      expect(stored?.completedAt).toBe(1700000000000);
      expect(stored?.filePath).toBe('/downloads/finished_video.mp4');

      // Case B: Delayed progress event without explicit status field
      updateProgress('done-item-1', {
        progress: 15,
        speed: '1.0 MB/s',
      });

      stored = useDownloadStore.getState().downloads.get('done-item-1');
      expect(stored?.status).toBe('done');
      expect(stored?.progress).toBe(100);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('1.2 protects cancelled and errored items against delayed progress reactivation', () => {
      const { addDownload, updateProgress } = useDownloadStore.getState();

      const cancelledItem: DownloadItem = {
        id: 'cancelled-item-1',
        title: 'Cancelled Video',
        url: 'https://youtube.com/watch?v=canc1',
        thumbnail: '',
        status: 'cancelled',
        progress: 30,
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=canc1' },
      };
      const errorItem: DownloadItem = {
        id: 'error-item-1',
        title: 'Error Video',
        url: 'https://youtube.com/watch?v=err1',
        thumbnail: '',
        status: 'error',
        errorMessage: 'Network timeout',
        progress: 10,
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=err1' },
      };
      addDownload(cancelledItem);
      addDownload(errorItem);

      // Attempt delayed progress on cancelled item
      updateProgress('cancelled-item-1', {
        status: 'downloading',
        progress: 60,
        speed: '3 MB/s',
      });
      expect(useDownloadStore.getState().downloads.get('cancelled-item-1')?.status).toBe('cancelled');

      // Attempt delayed progress on errored item
      updateProgress('error-item-1', {
        status: 'downloading',
        progress: 50,
      });
      const storedErr = useDownloadStore.getState().downloads.get('error-item-1');
      expect(storedErr?.status).toBe('error');
      expect(storedErr?.errorMessage).toBe('Network timeout');
      expect(unhandledRejections).toHaveLength(0);
    });

    it('1.3 maintains non-regressive monotonic progress during out-of-order IPC delivery', () => {
      const { addDownload, updateProgress } = useDownloadStore.getState();

      addDownload({
        id: 'jitter-item',
        title: 'Jitter Video',
        url: 'https://youtube.com/watch?v=jitter',
        thumbnail: '',
        status: 'downloading',
        progress: 0,
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=jitter' },
      });

      // Out-of-order arrival simulation: 20% -> 50% -> 35% (stale chunk)
      updateProgress('jitter-item', { progress: 20 });
      expect(useDownloadStore.getState().downloads.get('jitter-item')?.progress).toBe(20);

      updateProgress('jitter-item', { progress: 50 });
      expect(useDownloadStore.getState().downloads.get('jitter-item')?.progress).toBe(50);

      // Stale chunk arrives: monotonic invariant prevents backwards regression
      updateProgress('jitter-item', { progress: 35 });
      const current = useDownloadStore.getState().downloads.get('jitter-item')?.progress;
      expect(current).toBeGreaterThanOrEqual(50);
    });

    it('1.4 survives filesystem rejections during verifyDownloads without throwing unhandled rejections', async () => {
      const { addDownload, verifyDownloads } = useDownloadStore.getState();

      addDownload({
        id: 'unreachable-item',
        title: 'Unreachable Network File',
        url: 'https://youtube.com/watch?v=unreach',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/Volumes/DisconnectedShare/video.mp4',
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=unreach' },
      });

      // Simulate filesystem I/O rejection
      (window as any).electronAPI.fileExists = vi.fn().mockRejectedValue(new Error('EPERM: operation not permitted'));

      // Execution must not throw or leave unhandled promise rejection
      await expect(verifyDownloads()).resolves.not.toThrow();
      expect(unhandledRejections).toHaveLength(0);
    });

    it('1.5 safely executes clearFinishedDownloads during concurrent download mutations', () => {
      const { addDownload, updateProgress, clearFinishedDownloads } = useDownloadStore.getState();

      for (let i = 1; i <= 20; i++) {
        addDownload({
          id: `item-${i}`,
          title: `Item ${i}`,
          url: `https://youtube.com/watch?v=${i}`,
          thumbnail: '',
          status: i <= 10 ? 'done' : 'downloading',
          progress: i <= 10 ? 100 : 25,
          createdAt: Date.now() + i,
          config: { url: `https://youtube.com/watch?v=${i}` },
        });
      }

      // Mutate downloading item concurrently with clearFinishedDownloads
      updateProgress('item-15', { progress: 50 });
      clearFinishedDownloads();

      const remaining = useDownloadStore.getState().downloads;
      expect(remaining.size).toBe(10);
      expect(remaining.has('item-15')).toBe(true);
      expect(remaining.get('item-15')?.progress).toBe(50);
      expect(remaining.has('item-1')).toBe(false);
    });
  });

  // =========================================================================
  // SUITE 2: DownloadQueueEngine Rapid Lifecycle Storms & Microtask Races
  // =========================================================================
  describe('Suite 2: DownloadQueueEngine Rapid Lifecycle Storms & Microtask Races', () => {
    it('2.1 handles microtask pause-resume-pause-cancel storms without deadlock or slot leaks', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({
        delayMs: 20,
        stdoutChunks: ['[download] 25%\n', '[download] 75%\n'],
      });

      const queue = new DownloadQueueEngine({ runner, concurrency: 2 });
      await queue.add({ id: 'storm-1', url: 'https://youtube.com/storm1' });
      await queue.add({ id: 'storm-2', url: 'https://youtube.com/storm2' });

      expect(queue.getStatus().active).toBe(2);

      // Microtask interleaving storm
      const actions = [
        queue.pause('storm-1'),
        queue.resume('storm-1'),
        queue.pause('storm-1'),
        queue.cancel('storm-1'),
        queue.cancel('storm-2'),
      ];

      await Promise.all(actions);
      await new Promise((r) => setTimeout(r, 60));

      const status = queue.getStatus();
      expect(status.active).toBe(0);
      expect(status.cancelled).toBe(2);
      expect(queue.getItem('storm-1')?.status).toBe('cancelled');
      expect(queue.getItem('storm-2')?.status).toBe('cancelled');
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.2 gracefully handles dynamic concurrency downscale from 8 to 1 during active streaming', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({
        delayMs: 30,
        stdoutChunks: ['[download] 50%\n', '[download] 100%\n'],
      });

      const queue = new DownloadQueueEngine({ runner, concurrency: 8 });
      for (let i = 1; i <= 8; i++) {
        await queue.add({ id: `active-${i}`, url: `https://youtube.com/active${i}` });
      }

      expect(queue.getStatus().active).toBe(8);

      // Downscale concurrency to 1 while all 8 are downloading
      queue.setConcurrency(1);
      expect(queue.getConcurrency()).toBe(1);

      // Active items finish naturally; no new items must exceed limit of 1
      await new Promise((r) => setTimeout(r, 120));

      const status = queue.getStatus();
      expect(status.active).toBeLessThanOrEqual(1);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.3 immediately releases concurrency slot on 0ms instantaneous process crash', async () => {
      const runner = new MockProcessRunner();
      runner.onCommand(/crash-binary/, {
        spawnError: new Error('spawn yt-dlp ENOENT'),
      });
      runner.setDefaultResponse({
        delayMs: 10,
        stdoutChunks: ['[download] 100%\n'],
      });

      const queue = new DownloadQueueEngine({ runner, concurrency: 1 });

      await queue.add({ id: 'crash-item', url: 'https://youtube.com/crash-binary' });
      await queue.add({ id: 'normal-item', url: 'https://youtube.com/normal' });

      await new Promise((r) => setTimeout(r, 50));

      // Slot must be freed immediately and normal-item must complete
      expect(queue.getItem('crash-item')?.status).toBe('error');
      expect(queue.getItem('normal-item')?.status).toBe('done');
      expect(queue.getStatus().active).toBe(0);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.4 enforces strict priority scheduling without FIFO corruption', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({
        delayMs: 25,
        stdoutChunks: ['[download] 100%\n'],
      });

      const executionOrder: string[] = [];
      const queue = new DownloadQueueEngine({
        runner,
        concurrency: 1,
        onProgress: (id, p) => {
          if (p.percent === 100 && !executionOrder.includes(id)) {
            executionOrder.push(id);
          }
        },
      });

      // Item 1 (active)
      await queue.add({ id: 'low-1', url: 'https://youtube.com/low1', priority: 0 });
      // Items 2 and 3 (pending low)
      await queue.add({ id: 'low-2', url: 'https://youtube.com/low2', priority: 0 });
      await queue.add({ id: 'low-3', url: 'https://youtube.com/low3', priority: 0 });

      // Enqueue VIP item with priority 10
      await queue.add({ id: 'vip-urgent', url: 'https://youtube.com/vip', priority: 10 });

      // Wait for all to finish
      await new Promise((resolve) => {
        queue.on('queue:drained', resolve);
      });

      // Execution order must be low-1 -> vip-urgent -> low-2 -> low-3
      expect(executionOrder).toEqual(['low-1', 'vip-urgent', 'low-2', 'low-3']);
    });

    it('2.5 rapidly fires pauseAll and resumeAll toggle storm without orphaned active slots', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({
        delayMs: 20,
        stdoutChunks: ['[download] 50%\n', '[download] 100%\n'],
      });

      const queue = new DownloadQueueEngine({ runner, concurrency: 3 });
      for (let i = 1; i <= 6; i++) {
        await queue.add({ id: `batch-${i}`, url: `https://youtube.com/batch${i}` });
      }

      // Fire 10 rapid alternating pauseAll / resumeAll cycles
      for (let i = 0; i < 10; i++) {
        if (i % 2 === 0) {
          await queue.pauseAll();
        } else {
          await queue.resumeAll();
        }
      }

      // Concurrency must never exceed 3
      expect(queue.getStatus().active).toBeLessThanOrEqual(3);
      await queue.cancelAll();
      expect(queue.getStatus().active).toBe(0);
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 3: Adversarial Stream Parsing & Corrupted Media Outputs
  // =========================================================================
  describe('Suite 3: Adversarial Stream Parsing & Corrupted Media Outputs', () => {
    it('3.1 classifies [Errno 28] disk full error as non-transient disk_space category', () => {
      const stderr = 'ERROR: [Errno 28] No space left on device: \'/home/user/Downloads/video.mp4.part\'';
      const parsed = parseError(stderr, 1);

      expect(parsed.category).toBe('disk_space');
      expect(parsed.isTransient).toBe(false);
      expect(parsed.userMessage).toContain('disk space');
      expect(isTransientError(stderr)).toBe(false);
    });

    it('3.2 captures truncated container streams without regex or runner exceptions', () => {
      const stderr = 'ffmpeg error: moov atom not found, premature end of file in /tmp/video.mp4';
      const parsed = parseError(stderr, 1);

      expect(parsed.category).toBeDefined();
      expect(parsed.userMessage).toBeDefined();
      expect(parsed.exitCode).toBe(1);
    });

    it('3.3 safely sanitizes corrupt progress strings containing NaN or negative values', () => {
      // Degenerate yt-dlp outputs
      const nanOutput = '[download]   NaN% of ~   NaNMiB at    NaNB/s ETA NaN\n';
      const parsedNaN = parseProgress(nanOutput);

      if (parsedNaN) {
        expect(Number.isNaN(parsedNaN.percent)).toBe(false);
        expect(Number.isNaN(parsedNaN.speedBps || 0)).toBe(false);
        expect(Number.isNaN(parsedNaN.etaSeconds || 0)).toBe(false);
      }

      const negativeOutput = '[download]  -50.0% of  100.0MiB at  1.0MiB/s ETA 01:00\n';
      const parsedNeg = parseProgress(negativeOutput);
      if (parsedNeg) {
        expect(parsedNeg.percent).toBeGreaterThanOrEqual(0);
      }
    });

    it('3.4 processes 50,000 progress lines in a single chunk in <100ms without ReDoS', () => {
      const singleLine = '[download]  50.0% of  10.00MiB at  2.50MiB/s ETA 00:02\n';
      const massiveChunk = singleLine.repeat(50000);

      const startTime = performance.now();
      const result = parseStreamProgress(massiveChunk);
      const elapsed = performance.now() - startTime;

      expect(result).not.toBeNull();
      expect(result?.percent).toBe(50);
      expect(elapsed).toBeLessThan(100); // Must parse in <100ms
    });
  });

  // =========================================================================
  // SUITE 4: UI & View Component Adversarial Robustness
  // =========================================================================
  describe('Suite 4: UI & View Component Adversarial Robustness', () => {
    it('4.1 renders ClipTimeline with duration=0 without NaN% styles or React errors', () => {
      const onStartChange = vi.fn();
      const onEndChange = vi.fn();

      const { container } = render(
        React.createElement(ClipTimeline, {
          duration: 0,
          start: 0,
          end: 0,
          onStartChange,
          onEndChange,
        })
      );

      // Verify no NaN styles
      const handles = container.querySelectorAll('[role="slider"]');
      expect(handles.length).toBe(2);
      expect(container.innerHTML).not.toContain('NaN%');
    });

    it('4.2 sanitizes negative value inputs in TimeInput to >= 0', () => {
      const onChange = vi.fn();
      render(React.createElement(TimeInput, { label: 'Start', value: -15, onChange, maxDuration: 100 }));

      const inputs = screen.getAllByRole('spinbutton');
      expect(inputs[0]).toBeInTheDocument();
      // Should display 0 rather than negative minutes
      expect((inputs[0] as HTMLInputElement).value).toBe('0');
    });

    it('4.3 reconciles 20 resumed downloads with store without ghost active states', async () => {
      const { addDownload, resumeDownload } = useDownloadStore.getState();

      for (let i = 1; i <= 20; i++) {
        addDownload({
          id: `batch-res-${i}`,
          title: `Batch Resumed ${i}`,
          url: `https://youtube.com/watch?v=res${i}`,
          thumbnail: '',
          status: 'paused',
          progress: 10,
          createdAt: Date.now(),
          config: { url: `https://youtube.com/watch?v=res${i}` },
        });
      }

      // Resume all 20
      const resumes = Array.from({ length: 20 }, (_, i) => resumeDownload(`batch-res-${i + 1}`));
      await Promise.all(resumes);

      expect((window as any).electronAPI.resumeDownload).toHaveBeenCalledTimes(20);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('4.4 handles deleteFile (trash) rejection safely without UI crashes', async () => {
      (window as any).electronAPI.deleteFile = vi.fn().mockResolvedValue(false);

      const download: DownloadItem = {
        id: 'trash-test-1',
        title: 'File to Trash',
        url: 'https://youtube.com/watch?v=trash',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/nonexistent/file.mp4',
        createdAt: Date.now(),
        config: { url: 'https://youtube.com/watch?v=trash' },
      };

      useDownloadStore.getState().addDownload(download);

      render(React.createElement(DownloadCard, { download }));

      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      expect(deleteBtn).toBeInTheDocument();

      act(() => {
        fireEvent.click(deleteBtn);
      });

      expect(unhandledRejections).toHaveLength(0);
    });
  });
});
