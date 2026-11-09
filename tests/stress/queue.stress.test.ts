// @vitest-environment node
/**
 * tests/stress/queue.stress.test.ts
 * Empirical Stress Harness for DownloadQueueEngine and QueueItem state machine.
 *
 * Covers:
 * 1. High-concurrency throughput with 50+ queue items and dynamic concurrency bounds scaling (1 -> 8 -> 1).
 * 2. Rapid concurrent pause/resume storms on the same item, and batch pauseAll/resumeAll during active streaming.
 * 3. Cancellation during process startup, active download, and paused states.
 * 4. Verification of 0 zombie processes, 0 unhandled promise rejections, and 0 deadlocks.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner, RealProcessRunner } from '@/engine/runner';

function isZombieProcess(pid: number): boolean {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    return /State:\s+Z\s+\(zombie\)/i.test(status);
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('Empirical Adversarial Stress Harness: DownloadQueueEngine', () => {
  let unhandledRejections: any[] = [];
  let rejectionHandler: (err: any) => void;

  beforeEach(() => {
    unhandledRejections = [];
    rejectionHandler = (err: any) => {
      unhandledRejections.push(err);
    };
    process.on('unhandledRejection', rejectionHandler);
  });

  afterEach(() => {
    process.removeListener('unhandledRejection' as any, rejectionHandler);
  });

  // =========================================================================
  // SUITE 1: High-Concurrency Throughput & Dynamic Concurrency Scaling
  // =========================================================================
  describe('Suite 1: High-Concurrency Throughput & Dynamic Bounds Scaling', () => {
    it('1.1 correctly clamps concurrency limits to [1, 8] range across boundary values', () => {
      const mockRunner = new MockProcessRunner();
      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 3 });

      q.setConcurrency(0);
      expect(q.getConcurrency()).toBe(1);

      q.setConcurrency(-99);
      expect(q.getConcurrency()).toBe(1);

      q.setConcurrency(8);
      expect(q.getConcurrency()).toBe(8);

      q.setConcurrency(999);
      expect(q.getConcurrency()).toBe(8);

      q.setConcurrency(NaN as any);
      expect(q.getConcurrency()).toBe(3); // fallback
    });

    it('1.2 processes 60 queue items with dynamic concurrency scaling (1 -> 8 -> 2 -> 1) without illegal item starts or dropping items', async () => {
      const mockRunner = new MockProcessRunner();
      // Fast simulated delay: 10ms per chunk, 2 chunks
      mockRunner.setDefaultResponse({
        delayMs: 10,
        stdoutChunks: ['[download]  50.0% of ~ 10.0MiB\n', '[download] 100%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      const totalItems = 60;
      let illegalStarts = 0;
      let postRampdownViolations = 0;
      let rampDownPhase2Reached = false;
      let rampDownPhase1Reached = false;

      q.on('item:started', () => {
        // Invariant: When starting a new item, active must never exceed concurrency limit!
        if (q.getStatus().active > q.getConcurrency()) {
          illegalStarts++;
        }
      });

      q.on('queue:status', (status) => {
        if (q.getConcurrency() === 2) {
          if (!rampDownPhase2Reached && status.active <= 2) {
            rampDownPhase2Reached = true;
          }
          if (rampDownPhase2Reached && status.active > 2) {
            postRampdownViolations++;
          }
        } else if (q.getConcurrency() === 1) {
          if (!rampDownPhase1Reached && status.active <= 1) {
            rampDownPhase1Reached = true;
          }
          if (rampDownPhase1Reached && status.active > 1) {
            postRampdownViolations++;
          }
        }
      });

      // Ingest 60 items
      for (let i = 1; i <= totalItems; i++) {
        await q.add({ id: `batch-item-${i}`, url: `https://youtube.com/watch?v=${i}` });
      }

      expect(q.getStatus().active).toBe(1);
      expect(q.getStatus().queued).toBe(totalItems - 1);

      // Phase 1: Scale up concurrency to 4
      q.setConcurrency(4);
      expect(q.getConcurrency()).toBe(4);

      await new Promise((r) => setTimeout(r, 40));

      // Phase 2: Scale up concurrency to 8 (maximum)
      q.setConcurrency(8);
      expect(q.getConcurrency()).toBe(8);

      await new Promise((r) => setTimeout(r, 60));

      // Phase 3: Scale down concurrency to 2 (soft ramp-down)
      q.setConcurrency(2);
      expect(q.getConcurrency()).toBe(2);

      await new Promise((r) => setTimeout(r, 80));

      // Phase 4: Scale down concurrency to 1 (soft ramp-down)
      q.setConcurrency(1);
      expect(q.getConcurrency()).toBe(1);

      // Wait for all items to complete (drain timeout: 5s)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Queue failed to drain in time. Status: ${JSON.stringify(q.getStatus())}`));
        }, 5000);

        q.on('queue:drained', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const finalStatus = q.getStatus();
      expect(finalStatus.active).toBe(0);
      expect(finalStatus.queued).toBe(0);
      expect(finalStatus.done).toBe(totalItems);
      expect(illegalStarts).toBe(0);
      expect(postRampdownViolations).toBe(0);
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 2: Rapid Concurrent Pause/Resume Storms & Race Conditions
  // =========================================================================
  describe('Suite 2: Rapid Pause/Resume Storms & Race Conditions', () => {
    it('2.1 survives rapid back-and-forth toggle storm on same item without hanging or deadlocking', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 25,
        stdoutChunks: ['[download] 25%\n', '[download] 75%\n', '[download] 100%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });
      await q.add({ id: 'storm-item', url: 'https://youtube.com/storm' });

      // Rapidly fire alternating pause and resume calls
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          q.pause('storm-item');
        } else {
          q.resume('storm-item');
        }
      }

      // Explicitly resume at end so it finishes
      await q.resume('storm-item');

      // Wait for item to finish or stabilize
      await new Promise((r) => setTimeout(r, 200));

      const item = q.getItem('storm-item');
      // Must not be deadlocked or in an invalid state
      expect(['downloading', 'done']).toContain(item?.status);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.2 concurrent pause and resume (Promise.all) does not leave item stuck in paused queue forever', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 30,
        stdoutChunks: ['[download] 30%\n', '[download] 100%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      await q.add({ id: 'concurrent-pr', url: 'https://youtube.com/cpr' });

      expect(q.getStatus().active).toBe(1);

      // Fire concurrent pause and resume
      await Promise.all([q.pause('concurrent-pr'), q.resume('concurrent-pr')]);

      // Give time to finish
      await new Promise((r) => setTimeout(r, 150));

      const item = q.getItem('concurrent-pr');
      // If user paused then resumed, item should NOT be deadlocked in paused status
      expect(item?.status).not.toBe('paused');
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.3 [ADVERSARIAL] concurrent pause and cancel MUST NOT resurrect the cancelled item', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 50,
        stdoutChunks: ['[download] 20%\n', '[download] 60%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      await q.add({ id: 'race-cancel', url: 'https://youtube.com/race-cancel' });

      expect(q.getStatus().active).toBe(1);

      // Concurrent pause and cancel
      const pausePromise = q.pause('race-cancel');
      const cancelPromise = q.cancel('race-cancel');

      await Promise.all([pausePromise, cancelPromise]);
      await new Promise((r) => setTimeout(r, 100));

      const item = q.getItem('race-cancel');
      const status = q.getStatus();

      // Invariant: The item was cancelled, so its final status MUST be 'cancelled', NOT 'downloading'!
      expect(item?.status).toBe('cancelled');
      expect(status.active).toBe(0);
      expect(status.queued).toBe(0);
      expect(status.cancelled).toBe(1);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('2.4 rapid idempotent duplicate pause and cancel calls do not crash or corrupt queue', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({ delayMs: 40 });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });
      await q.add({ id: 'dup-1', url: 'https://youtube.com/dup1' });
      await q.add({ id: 'dup-2', url: 'https://youtube.com/dup2' });

      // Duplicate pauses
      await Promise.all([q.pause('dup-1'), q.pause('dup-1'), q.pause('dup-1')]);
      expect(q.getItem('dup-1')?.status).toBe('paused');

      // Duplicate cancels
      await Promise.all([q.cancel('dup-2'), q.cancel('dup-2'), q.cancel('dup-2')]);
      expect(q.getItem('dup-2')?.status).toBe('cancelled');

      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 3: Batch Operations During Active Streaming
  // =========================================================================
  describe('Suite 3: Batch Operations During Active Streaming', () => {
    it('3.1 pauseAll cleanly stops 4 active downloads and preserves queue integrity', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 80,
        stdoutChunks: ['[download] 10%\n', '[download] 50%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 4 });
      for (let i = 1; i <= 6; i++) {
        await q.add({ id: `batch-item-${i}`, url: `https://youtube.com/${i}` });
      }

      expect(q.getStatus().active).toBe(4);
      expect(q.getStatus().queued).toBe(2);

      await q.pauseAll();

      const status = q.getStatus();
      expect(status.active).toBe(0);
      expect(status.paused).toBe(6);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('3.2 concurrent pauseAll and resumeAll during active downloads does not corrupt active slots or leak unhandled rejections', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 50,
        stdoutChunks: ['[download] 25%\n', '[download] 75%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 3 });
      for (let i = 1; i <= 6; i++) {
        await q.add({ id: `batch-c-${i}`, url: `https://youtube.com/${i}` });
      }

      expect(q.getStatus().active).toBe(3);

      // Concurrent batch storm
      await Promise.all([q.pauseAll(), q.resumeAll()]);

      await new Promise((r) => setTimeout(r, 80));

      const status = q.getStatus();
      // Concurrency invariant: active must not exceed concurrency (3)
      expect(status.active).toBeLessThanOrEqual(3);
      // Total items must remain exactly 6
      expect(status.total).toBe(6);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('3.3 cancelAll terminates all active and queued items with 0 lingering active downloads', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 60,
        stdoutChunks: ['[download] 10%\n', '[download] 40%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 3 });
      for (let i = 1; i <= 6; i++) {
        await q.add({ id: `cancel-all-${i}`, url: `https://youtube.com/${i}` });
      }

      expect(q.getStatus().active).toBe(3);
      expect(q.getStatus().queued).toBe(3);

      await q.cancelAll();

      const status = q.getStatus();
      expect(status.active).toBe(0);
      expect(status.queued).toBe(0);
      expect(status.cancelled).toBe(6);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('3.4 [ADVERSARIAL] concurrent pauseAll and cancelAll MUST NOT leave any items downloading or queued', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 50,
        stdoutChunks: ['[download] 20%\n', '[download] 60%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 3 });
      for (let i = 1; i <= 6; i++) {
        await q.add({ id: `batch-pc-${i}`, url: `https://youtube.com/${i}` });
      }

      expect(q.getStatus().active).toBe(3);

      // Concurrent batch storm: pauseAll and cancelAll
      await Promise.all([q.pauseAll(), q.cancelAll()]);

      await new Promise((r) => setTimeout(r, 120));

      const status = q.getStatus();
      console.log('Test 3.4 Result - Queue Status:', status, q.getAllItems().map(i => ({ id: i.id, status: i.status })));

      // Invariant: cancelAll was called, so active and queued MUST be 0!
      expect(status.active).toBe(0);
      expect(status.queued).toBe(0);
      expect(status.cancelled).toBe(6);
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 4: Cancellation Across Lifecycle States (Startup, Active, Paused)
  // =========================================================================
  describe('Suite 4: Cancellation Across Lifecycle States', () => {
    it('4.1 cancels item during process startup before any chunks arrive', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 100,
        stdoutChunks: ['[download] 10%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      const addPromise = q.add({ id: 'startup-item', url: 'https://youtube.com/startup' });

      // Cancel immediately after enqueueing
      const cancelPromise = q.cancel('startup-item');
      await Promise.all([addPromise, cancelPromise]);

      await new Promise((r) => setTimeout(r, 50));

      const item = q.getItem('startup-item');
      expect(item?.status).toBe('cancelled');
      expect(q.getStatus().active).toBe(0);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('4.2 cancels item during active download and frees slot for next item', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 60,
        stdoutChunks: ['[download] 20%\n', '[download] 80%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      await q.add({ id: 'active-item', url: 'https://youtube.com/active' });
      await q.add({ id: 'waiting-item', url: 'https://youtube.com/waiting' });

      expect(q.getStatus().active).toBe(1);
      expect(q.getStatus().queued).toBe(1);

      await q.cancel('active-item');

      expect(q.getItem('active-item')?.status).toBe('cancelled');
      // Waiting item should now have claimed the slot
      expect(q.getStatus().active).toBe(1);
      expect(q.getItem('waiting-item')?.status).toBe('downloading');
      expect(unhandledRejections).toHaveLength(0);
    });

    it('4.3 cancels item in paused state without spawning or crashing', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({ delayMs: 40 });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 1 });
      await q.add({ id: 'pause-cancel-item', url: 'https://youtube.com/pc' });
      await q.pause('pause-cancel-item');

      expect(q.getItem('pause-cancel-item')?.status).toBe('paused');

      await q.cancel('pause-cancel-item');
      expect(q.getItem('pause-cancel-item')?.status).toBe('cancelled');
      expect(q.getStatus().active).toBe(0);
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  // =========================================================================
  // SUITE 5: Real Process Execution, OS Zombies, and Deadlocks
  // =========================================================================
  describe('Suite 5: Real Processes, 0 Zombies, and 0 Deadlocks', () => {
    it('5.1 verifies 0 zombie processes and 0 leaked child processes under RealProcessRunner cancellations', async () => {
      const realRunner = new RealProcessRunner();
      const spawnedPids: number[] = [];

      const origSpawn = realRunner.spawnStream.bind(realRunner);
      realRunner.spawnStream = (command, args, callbacks, options) => {
        const handle = origSpawn(command, args, callbacks, options);
        if (handle.pid) spawnedPids.push(handle.pid);
        return handle;
      };

      const q = new DownloadQueueEngine({
        runner: realRunner,
        binaryPath: process.execPath,
        concurrency: 3,
        argsBuilder: () => ['-e', 'setInterval(() => {}, 500)'],
      });

      for (let i = 1; i <= 6; i++) {
        await q.add({ id: `real-${i}`, url: `https://mock/${i}` });
      }

      await new Promise((r) => setTimeout(r, 80));
      expect(spawnedPids.length).toBeGreaterThanOrEqual(3);

      await q.cancelAll();

      // Wait 150ms for process termination and kernel reap
      await new Promise((r) => setTimeout(r, 150));

      expect(q.getStatus().active).toBe(0);
      expect(q.getStatus().cancelled).toBe(6);

      // Verify all spawned child processes are DEAD and NOT ZOMBIES
      for (const pid of spawnedPids) {
        expect(isProcessAlive(pid)).toBe(false);
        expect(isZombieProcess(pid)).toBe(false);
      }

      expect(unhandledRejections).toHaveLength(0);
    }, 10000);

    it('5.2 ensures queue does not deadlock: pending non-paused items must always execute when active is 0', async () => {
      const mockRunner = new MockProcessRunner();
      mockRunner.setDefaultResponse({
        delayMs: 15,
        stdoutChunks: ['[download] 100%\n'],
      });

      const q = new DownloadQueueEngine({ runner: mockRunner, concurrency: 2 });
      for (let i = 1; i <= 8; i++) {
        await q.add({ id: `deadlock-check-${i}`, url: `https://youtube.com/${i}` });
      }

      // Check intermittently that if active == 0, queued must also be 0 (no deadlock)
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          const status = q.getStatus();
          if (status.active === 0 && status.queued > 0) {
            reject(new Error(`Queue deadlocked! Active: 0, Queued: ${status.queued}`));
          } else {
            resolve();
          }
        }, 3000);

        q.on('queue:drained', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      const finalStatus = q.getStatus();
      expect(finalStatus.active).toBe(0);
      expect(finalStatus.queued).toBe(0);
      expect(finalStatus.done).toBe(8);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('5.3 buildArgs error does not permanently leak active concurrency slot', async () => {
      const mockRunner = new MockProcessRunner();
      let shouldThrow = true;
      const q = new DownloadQueueEngine({
        runner: mockRunner,
        concurrency: 1,
        argsBuilder: () => {
          if (shouldThrow) {
            throw new Error('Malformed URL / invalid args');
          }
          return ['--test'];
        },
      });

      // Item 1 throws during startItem -> buildArgs
      try {
        await q.add({ id: 'bad-args-item', url: 'https://bad' });
      } catch {}

      // Wait a tick
      await new Promise((r) => setTimeout(r, 20));

      const status1 = q.getStatus();

      // Now add a valid item: can it run? Or is concurrency slot leaked?
      shouldThrow = false;
      await q.add({ id: 'good-args-item', url: 'https://good' });

      await new Promise((r) => setTimeout(r, 20));
      const status2 = q.getStatus();

      // The slot should NOT be leaked!
      expect(status1.active).toBe(0);
      expect(q.getItem('bad-args-item')?.status).toBe('error');
      expect(q.getItem('good-args-item')?.status).toBe('done');
    });
  });
});

