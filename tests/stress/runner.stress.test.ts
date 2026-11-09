// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import { RealProcessRunner, MockProcessRunner } from '@/engine/runner';

/**
 * Helper to check if a process with given PID is a zombie in Linux.
 * On Linux, /proc/<pid>/status contains "State:\tZ (zombie)".
 */
function isZombieProcess(pid: number): boolean {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    return /State:\s+Z\s+\(zombie\)/i.test(status);
  } catch {
    // Process is completely reaped / does not exist
    return false;
  }
}

/**
 * Helper to check if a process is still alive.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe('Empirical Stress Harness: IProcessRunner', () => {
  describe('RealProcessRunner Stress & Concurrency', () => {
    let runner: RealProcessRunner;
    const unhandledRejections: any[] = [];
    let rejectionHandler: (err: any) => void;

    beforeEach(() => {
      runner = new RealProcessRunner();
      unhandledRejections.length = 0;
      rejectionHandler = (err: any) => {
        unhandledRejections.push(err);
      };
      process.on('unhandledRejection', rejectionHandler);
    });

    afterEach(() => {
      process.removeListener('unhandledRejection' as any, rejectionHandler);
    });

    it('handles 50 concurrent short-lived child processes without failure or zombies', async () => {
      const concurrency = 50;
      const startTime = Date.now();
      const pids: number[] = [];

      const tasks = Array.from({ length: concurrency }, async (_, i) => {
        const handle = runner.spawnStream(
          process.execPath,
          ['-e', `process.stdout.write(JSON.stringify({ id: ${i}, pid: process.pid }))`]
        );

        if (handle.pid) {
          pids.push(handle.pid);
        }

        const res = await handle.wait();
        expect(res.exitCode).toBe(0);
        const data = JSON.parse(res.stdout);
        expect(data.id).toBe(i);
        expect(data.pid).toBeGreaterThan(0);
        return data.pid;
      });

      const spawnedPids = await Promise.all(tasks);
      const durationMs = Date.now() - startTime;

      expect(spawnedPids).toHaveLength(concurrency);
      // Ensure all PIDs are unique
      const uniquePids = new Set(spawnedPids);
      expect(uniquePids.size).toBe(concurrency);

      // Verify no child process remains as a zombie
      // Allow 50ms for kernel reap synchronization
      await new Promise((r) => setTimeout(r, 50));
      for (const pid of pids) {
        expect(isZombieProcess(pid)).toBe(false);
      }

      expect(unhandledRejections).toHaveLength(0);
    }, 15000);

    it('rapidly creates and kills streaming processes at 5ms, 10ms, and 50ms intervals', async () => {
      const intervals = [5, 10, 50];
      const spawnedPids: number[] = [];

      for (const interval of intervals) {
        // Run 5 rapid cycles for each interval
        for (let cycle = 0; cycle < 5; cycle++) {
          const handle = runner.spawnStream(
            process.execPath,
            [
              '-e',
              `setInterval(() => { process.stdout.write("burst\\n"); }, 2); setTimeout(() => process.exit(0), 10000);`,
            ]
          );

          expect(handle.pid).toBeDefined();
          const pid = handle.pid!;
          spawnedPids.push(pid);

          await new Promise((r) => setTimeout(r, interval));
          await handle.kill('SIGKILL');

          const res = await handle.wait();
          expect(res.exitCode).toBe(137);

          // Verify process is killed and not a zombie
          await new Promise((r) => setTimeout(r, 20));
          expect(isProcessAlive(pid)).toBe(false);
          expect(isZombieProcess(pid)).toBe(false);
        }
      }

      expect(unhandledRejections).toHaveLength(0);
    }, 15000);

    it('kills process immediately (0ms race condition) before code execution begins', async () => {
      for (let i = 0; i < 10; i++) {
        const handle = runner.spawnStream(
          process.execPath,
          ['-e', 'setTimeout(() => process.exit(0), 5000);']
        );
        const pid = handle.pid!;

        // Synchronously trigger kill without waiting for next event loop turn
        const killPromise = handle.kill('SIGKILL');
        const [killResult, res] = await Promise.all([killPromise, handle.wait()]);

        expect(res.exitCode).toBe(137);

        await new Promise((r) => setTimeout(r, 20));
        expect(isProcessAlive(pid)).toBe(false);
        expect(isZombieProcess(pid)).toBe(false);
      }

      expect(unhandledRejections).toHaveLength(0);
    }, 10000);

    it('terminates entire process tree (grandchild processes) via process group kill', async () => {
      // Spawn a node parent that spawns a grandchild node process
      const script = `
        const { spawn } = require('child_process');
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
        process.stdout.write(JSON.stringify({ grandchildPid: child.pid }));
        setInterval(() => {}, 1000);
      `;

      let grandchildPid: number | undefined;
      const handle = runner.spawnStream(
        process.execPath,
        ['-e', script],
        {
          onStdoutChunk: (chunk) => {
            try {
              const data = JSON.parse(chunk);
              grandchildPid = data.grandchildPid;
            } catch {}
          },
        }
      );

      const parentPid = handle.pid!;
      // Wait until grandchild is running
      for (let i = 0; i < 50; i++) {
        if (grandchildPid) break;
        await new Promise((r) => setTimeout(r, 20));
      }

      expect(grandchildPid).toBeDefined();
      expect(isProcessAlive(grandchildPid!)).toBe(true);
      expect(isProcessAlive(parentPid)).toBe(true);

      // Kill the parent process handle
      await handle.kill('SIGKILL');
      await handle.wait();

      // Wait 50ms for process group kill to propagate
      await new Promise((r) => setTimeout(r, 50));

      // BOTH parent and grandchild should be dead!
      expect(isProcessAlive(parentPid)).toBe(false);
      expect(isProcessAlive(grandchildPid!)).toBe(false);
      expect(isZombieProcess(parentPid)).toBe(false);
      expect(isZombieProcess(grandchildPid!)).toBe(false);
      expect(unhandledRejections).toHaveLength(0);
    }, 10000);

    it('terminates child process even when detached: false is explicitly configured', async () => {
      const handle = runner.spawnStream(
        process.execPath,
        ['-e', 'setInterval(() => {}, 1000);'],
        undefined,
        { detached: false }
      );

      const pid = handle.pid!;
      expect(pid).toBeDefined();
      expect(isProcessAlive(pid)).toBe(true);

      await handle.kill('SIGKILL');
      await handle.wait();

      await new Promise((r) => setTimeout(r, 50));
      // Defect check: If process.kill(-pid) threw ESRCH and was ignored, child is still alive!
      expect(isProcessAlive(pid)).toBe(false);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('is idempotent on concurrent duplicate kill() calls', async () => {
      const handle = runner.spawnStream(
        process.execPath,
        ['-e', 'setInterval(() => {}, 500)']
      );

      // Trigger multiple concurrent kill calls
      await Promise.all([
        handle.kill('SIGKILL'),
        handle.kill('SIGKILL'),
        handle.kill('SIGKILL'),
      ]);

      const res = await handle.wait();
      expect(res.exitCode).toBe(137);
      expect(unhandledRejections).toHaveLength(0);
    });

    it('does not produce unhandled promise rejections on binary spawn failures when wait() is caught', async () => {
      const errorCount = 10;
      const handles = Array.from({ length: errorCount }, () => {
        let errCalled = false;
        const h = runner.spawnStream(
          '__non_existent_binary_stress_probe_xyz__',
          [],
          {
            onError: () => {
              errCalled = true;
            },
          }
        );
        return { h, getErrCalled: () => errCalled };
      });

      // Await all wait() promises handling their rejections
      for (const { h } of handles) {
        await expect(h.wait()).rejects.toThrow();
      }

      // Check that unhandledRejection event was never fired
      await new Promise((r) => setTimeout(r, 50));
      expect(unhandledRejections).toHaveLength(0);
    });

    it('does not leak unhandled promise rejection when handle.wait() is NOT awaited (callback-only consumer)', async () => {
      let callbackErrorCaught = false;
      const handle = runner.spawnStream(
        '__non_existent_binary_stress_probe_xyz__',
        [],
        {
          onError: (err) => {
            callbackErrorCaught = true;
          },
        }
      );

      // Do NOT call or await handle.wait()
      await new Promise((r) => setTimeout(r, 100));
      expect(callbackErrorCaught).toBe(true);
      expect(unhandledRejections).toHaveLength(0);
    });
  });

  describe('MockProcessRunner Stress & Concurrency', () => {
    let mock: MockProcessRunner;
    const unhandledRejections: any[] = [];
    let rejectionHandler: (err: any) => void;

    beforeEach(() => {
      mock = new MockProcessRunner();
      unhandledRejections.length = 0;
      rejectionHandler = (err: any) => {
        unhandledRejections.push(err);
      };
      process.on('unhandledRejection', rejectionHandler);
    });

    afterEach(() => {
      process.removeListener('unhandledRejection' as any, rejectionHandler);
      mock.reset();
    });

    it('accurately resolves specific command rules without substring shadowing in MockProcessRunner', async () => {
      // Register rule for a short command or URL
      mock.onCommand('yt-dlp', { stdoutChunks: ['base\n'], exitCode: 0 });
      mock.onCommand('yt-dlp --dump-json', { stdoutChunks: ['json\n'], exitCode: 0 });

      // When invoking the more specific rule:
      const res = await mock.exec('yt-dlp', ['--dump-json']);
      // A specific rule must not be shadowed by an earlier substring rule
      expect(res.stdout).toBe('json\n');
    });

    it('matches exact commands with end-of-string anchors without trailing whitespace corruption', async () => {
      // With end anchor '$', matching must succeed when args are empty without inserting trailing space
      mock.onCommand(/^yt-dlp$/, { stdoutChunks: ['version 1.0\n'], exitCode: 0 });

      const res = await mock.exec('yt-dlp', []);
      expect(res.stdout).toBe('version 1.0\n');
    });

    it('rapidly registers and evaluates 250+ rules with non-colliding distinct matchers', async () => {
      const ruleCount = 300;
      const startTime = Date.now();

      // Use fixed-width zero-padded tokens and space-tolerant regex
      for (let i = 0; i < ruleCount; i++) {
        const token = String(i).padStart(5, '0');
        const mod = i % 3;
        if (mod === 0) {
          // Exact string matcher
          mock.onCommand(`exact_cmd_${token}`, {
            stdoutChunks: [`stdout_${token}`],
            exitCode: 0,
          });
        } else if (mod === 1) {
          // RegExp matcher (tolerating the current trailing space)
          mock.onCommand(new RegExp(`^regex_cmd_${token} ?`), {
            stdoutChunks: [`regex_stdout_${token}`],
            exitCode: 0,
          });
        } else {
          // Predicate matcher
          mock.onCommand(
            (cmd, args) => cmd === 'pred' && args[0] === `arg_${token}`,
            {
              stdoutChunks: [`pred_stdout_${token}`],
              exitCode: 0,
            }
          );
        }
      }

      // Fire 300 concurrent requests matching all 300 rules
      const tasks = Array.from({ length: ruleCount }, async (_, i) => {
        const token = String(i).padStart(5, '0');
        const mod = i % 3;
        if (mod === 0) {
          const res = await mock.exec(`exact_cmd_${token}`, []);
          expect(res.stdout).toBe(`stdout_${token}`);
        } else if (mod === 1) {
          const res = await mock.exec(`regex_cmd_${token}`, []);
          expect(res.stdout).toBe(`regex_stdout_${token}`);
        } else {
          const res = await mock.exec('pred', [`arg_${token}`]);
          expect(res.stdout).toBe(`pred_stdout_${token}`);
        }
      });

      await Promise.all(tasks);
      const elapsed = Date.now() - startTime;

      expect(mock.getInvocations()).toHaveLength(ruleCount);
      expect(elapsed).toBeLessThan(1000);
    });

    it('does not leak unhandled promise rejection in MockProcessRunner when handle.wait() is NOT awaited', async () => {
      let mockErr: any;
      mock.onCommand('fail_cmd', { spawnError: new Error('mock failure') });
      const handle = mock.spawnStream('fail_cmd', [], {
        onError: (err) => {
          mockErr = err;
        },
      });

      // Do NOT call handle.wait()
      await new Promise((r) => setTimeout(r, 100));
      expect(mockErr).toBeDefined();
      expect(unhandledRejections).toHaveLength(0);
    });

    it('handles high-concurrency sequential queue consumption deterministically', async () => {
      const queueDepth = 100;
      for (let i = 0; i < queueDepth; i++) {
        mock.queueResponse({
          stdoutChunks: [`queued_item_${i}\n`],
          exitCode: 0,
        });
      }

      // Concurrently invoke mock.exec
      const results = await Promise.all(
        Array.from({ length: queueDepth }, (_, i) =>
          mock.exec('yt-dlp', [`--index=${i}`])
        )
      );

      // Verify that every response in the queue was popped in strict FIFO order
      results.forEach((res, index) => {
        expect(res.stdout).toBe(`queued_item_${index}\n`);
      });

      expect(mock.getInvocations()).toHaveLength(queueDepth);
    });

    it('stress-tests multi-stream timer aborts with randomized kill timing', async () => {
      const streamCount = 40;
      const abortJitters = [2, 5, 10, 18, 25];

      const handles = Array.from({ length: streamCount }, (_, i) => {
        mock.onCommand(`delayed_stream_${i}`, {
          stdoutChunks: ['chunkA\n', 'chunkB\n', 'chunkC\n', 'chunkD\n'],
          delayMs: 15,
          exitCode: 0,
        });

        const stdoutChunks: string[] = [];
        const handle = mock.spawnStream(`delayed_stream_${i}`, [], {
          onStdoutChunk: (chunk) => stdoutChunks.push(chunk),
        });

        return { handle, stdoutChunks, jitter: abortJitters[i % abortJitters.length] };
      });

      // Kill each handle at its designated jitter
      const killTasks = handles.map(async ({ handle, jitter, stdoutChunks }) => {
        await new Promise((r) => setTimeout(r, jitter));
        await handle.kill('SIGKILL');

        const res = await handle.wait();
        expect(res.exitCode).toBe(137);
        // Ensure that chunks did not all deliver if aborted early
        if (jitter <= 10) {
          expect(stdoutChunks.length).toBeLessThan(4);
        }
      });

      await Promise.all(killTasks);
    });

    it('correctly handles rule exhaustion with times: N under high concurrency', async () => {
      const timesAllowed = 10;
      mock.onCommand('limited', { stdoutChunks: ['granted'], exitCode: 0 }, timesAllowed);
      mock.setDefaultResponse({ stdoutChunks: ['exhausted'], exitCode: 1 });

      // Run 25 concurrent requests
      const results = await Promise.all(
        Array.from({ length: 25 }, () => mock.exec('limited', []))
      );

      const granted = results.filter((r) => r.stdout === 'granted' && r.exitCode === 0);
      const exhausted = results.filter((r) => r.stdout === 'exhausted' && r.exitCode === 1);

      expect(granted).toHaveLength(timesAllowed);
      expect(exhausted).toHaveLength(15);
    });

    it('survives massive output chunk volume without stream corruption', async () => {
      const totalChunks = 1000;
      const chunks = Array.from({ length: totalChunks }, (_, i) => `chunk_${i}\n`);

      mock.onCommand('large_volume', {
        stdoutChunks: chunks,
        exitCode: 0,
      });

      const collected: string[] = [];
      const handle = mock.spawnStream('large_volume', [], {
        onStdoutChunk: (c) => collected.push(c),
      });

      const res = await handle.wait();
      expect(res.exitCode).toBe(0);
      expect(collected).toHaveLength(totalChunks);
      expect(res.stdout).toBe(chunks.join(''));
    });
  });
});
