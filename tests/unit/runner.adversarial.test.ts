// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealProcessRunner, MockProcessRunner } from '@/engine/runner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Adversarial & Fault Injection Stress Suite', () => {
  describe('RealProcessRunner Fault Injection', () => {
    let runner: RealProcessRunner;
    let tempDir: string;

    beforeEach(() => {
      runner = new RealProcessRunner();
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'offliner-adv-'));
    });

    afterEach(() => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    });

    it('fault-1: non-existent binary path rejects cleanly with ENOENT without hanging', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist-binary');
      const onError = vi.fn();
      const onExit = vi.fn();

      const handle = runner.spawnStream(nonExistentPath, ['--foo'], {
        onError,
        onExit,
      });

      await expect(handle.wait()).rejects.toThrow();
      expect(onError).toHaveBeenCalledTimes(1);
      const err = onError.mock.calls[0][0];
      expect((err as any).code).toBe('ENOENT');
      expect(onExit).not.toHaveBeenCalled();
    });

    it('fault-2: unexecutable non-binary file (permission denied / EACCES) rejects without hang', async () => {
      const nonExecFile = path.join(tempDir, 'unexecutable.sh');
      fs.writeFileSync(nonExecFile, '#!/bin/sh\necho "hello"\n', { mode: 0o644 });

      const onError = vi.fn();
      const onExit = vi.fn();

      const handle = runner.spawnStream(nonExecFile, [], { onError, onExit });

      await expect(handle.wait()).rejects.toThrow();
      expect(onError).toHaveBeenCalledTimes(1);
      const err = onError.mock.calls[0][0];
      expect(['EACCES', 'ENOEXEC', 'EPERM']).toContain((err as any).code);
      expect(onExit).not.toHaveBeenCalled();
    });

    it('fault-3: zero-permission file (000) rejects with EACCES', async () => {
      const zeroPermFile = path.join(tempDir, 'no-perms.bin');
      fs.writeFileSync(zeroPermFile, 'binary-blob', { mode: 0o000 });

      const onError = vi.fn();
      const handle = runner.spawnStream(zeroPermFile, [], { onError });

      await expect(handle.wait()).rejects.toThrow();
      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0][0] as any).code).toBe('EACCES');
    });

    it('fault-4: kill() on a failed spawn is idempotent and does not throw', async () => {
      const nonExistent = path.join(tempDir, 'ghost-bin');
      const handle = runner.spawnStream(nonExistent, []);

      // Catch the rejection on wait()
      const waitPromise = handle.wait().catch((e) => e);

      // Call kill immediately and repeatedly
      await expect(handle.kill('SIGKILL')).resolves.toBeUndefined();
      await expect(handle.kill('SIGTERM')).resolves.toBeUndefined();

      const err = await waitPromise;
      expect((err as any).code).toBe('ENOENT');
    });

    it('fault-5: huge stdout stream (50MB) buffers without truncation, deadlock, or backpressure drop', async () => {
      // Generate 50MB of text output via Node process (50 chunks of 1MB)
      const script = `
        const chunk = "X".repeat(1024 * 1024);
        for (let i = 0; i < 50; i++) {
          process.stdout.write(chunk);
        }
      `;

      let totalReceived = 0;
      let chunkCount = 0;

      const handle = runner.spawnStream(process.execPath, ['-e', script], {
        onStdoutChunk: (chunk) => {
          totalReceived += Buffer.byteLength(chunk, 'utf8');
          chunkCount++;
        },
      });

      const result = await handle.wait();
      expect(result.exitCode).toBe(0);
      expect(totalReceived).toBe(50 * 1024 * 1024);
      expect(result.stdout.length).toBe(50 * 1024 * 1024);
      expect(chunkCount).toBeGreaterThan(1);
    }, 20000);

    it('fault-6: simultaneous high-volume stdout (10MB) and stderr (10MB) streams do not deadlock', async () => {
      const script = `
        const chunkOut = "O".repeat(1024 * 1024);
        const chunkErr = "E".repeat(1024 * 1024);
        for (let i = 0; i < 10; i++) {
          process.stdout.write(chunkOut);
          process.stderr.write(chunkErr);
        }
      `;

      let outBytes = 0;
      let errBytes = 0;

      const handle = runner.spawnStream(process.execPath, ['-e', script], {
        onStdoutChunk: (c) => { outBytes += Buffer.byteLength(c, 'utf8'); },
        onStderrChunk: (c) => { errBytes += Buffer.byteLength(c, 'utf8'); },
      });

      const result = await handle.wait();
      expect(result.exitCode).toBe(0);
      expect(outBytes).toBe(10 * 1024 * 1024);
      expect(errBytes).toBe(10 * 1024 * 1024);
      expect(result.stdout.length).toBe(10 * 1024 * 1024);
      expect(result.stderr.length).toBe(10 * 1024 * 1024);
    }, 15000);

    it('fault-7: signal normalization on SIGTERM returns exitCode 143', async () => {
      const script = 'setInterval(() => {}, 100);';
      const onExit = vi.fn();

      const handle = runner.spawnStream(process.execPath, ['-e', script], { onExit });
      await new Promise((r) => setTimeout(r, 100));

      await handle.kill('SIGTERM');
      const result = await handle.wait();

      expect(result.exitCode).toBe(143);
      expect(onExit).toHaveBeenCalledWith(143, 'SIGTERM');
    });

    it('fault-8: signal normalization on SIGKILL returns exitCode 137', async () => {
      const script = 'setInterval(() => {}, 100);';
      const onExit = vi.fn();

      const handle = runner.spawnStream(process.execPath, ['-e', script], { onExit });
      await new Promise((r) => setTimeout(r, 100));

      await handle.kill('SIGKILL');
      const result = await handle.wait();

      expect(result.exitCode).toBe(137);
      expect(onExit).toHaveBeenCalledWith(137, 'SIGKILL');
    });

    it('fault-9: double kill() and kill after normal exit are strictly idempotent', async () => {
      const handle = runner.spawnStream(process.execPath, ['-e', 'process.stdout.write("done");']);
      const res = await handle.wait();
      expect(res.exitCode).toBe(0);

      // Kill after process has cleanly exited
      await expect(handle.kill('SIGKILL')).resolves.toBeUndefined();
      await expect(handle.kill('SIGTERM')).resolves.toBeUndefined();

      // Wait again returns same cached result
      const res2 = await handle.wait();
      expect(res2.exitCode).toBe(0);
      expect(res2.stdout).toBe('done');
    });

    it('fault-10: RealProcessHandle.kill successfully terminates process when detached: false', async () => {
      const handle = runner.spawnStream(
        process.execPath,
        ['-e', 'setInterval(() => {}, 100);'],
        undefined,
        { detached: false }
      );

      await new Promise((r) => setTimeout(r, 100));
      await handle.kill('SIGKILL');
      const res = await handle.wait();
      expect(res.exitCode).toBe(137);

      await new Promise((r) => setTimeout(r, 50));

      let isStillRunning = false;
      try {
        process.kill(handle.pid!, 0);
        isStillRunning = true;
      } catch {
        isStillRunning = false;
      }

      if (isStillRunning) {
        try { process.kill(handle.pid!, 'SIGKILL'); } catch {}
      }

      expect(isStillRunning).toBe(false);
    });
  });

  describe('MockProcessRunner Adversarial Stress', () => {
    let mock: MockProcessRunner;

    beforeEach(() => {
      mock = new MockProcessRunner();
    });

    afterEach(() => {
      mock.reset();
    });

    it('mock-1: strict mode throws on unregistered command in exec()', async () => {
      mock.setStrict(true);
      await expect(mock.exec('unregistered-bin', ['arg1'])).rejects.toThrow(
        /MockProcessRunner \[STRICT\]: No mock response registered for "unregistered-bin arg1"/
      );
    });

    it('mock-2: strict mode triggers onError callback on spawnStream', async () => {
      mock.setStrict(true);
      const onError = vi.fn();

      const handle = mock.spawnStream('unregistered-bin', ['arg1'], { onError });
      await expect(handle.wait()).rejects.toThrow(/MockProcessRunner \[STRICT\]/);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toContain('unregistered-bin arg1');
    });

    it('mock-3: double kill() on MockProcessHandle is idempotent', async () => {
      mock.onCommand('long-run', {
        stdoutChunks: ['part1', 'part2'],
        delayMs: 100,
      });

      const onExit = vi.fn();
      const handle = mock.spawnStream('long-run', [], { onExit });

      await new Promise((r) => setTimeout(r, 50));

      // Call kill twice simultaneously
      const [k1, k2] = await Promise.all([
        handle.kill('SIGKILL'),
        handle.kill('SIGKILL'),
      ]);

      expect(k1).toBeUndefined();
      expect(k2).toBeUndefined();

      const res = await handle.wait();
      expect(res.exitCode).toBe(137);
      // onExit must only be called once despite multiple kill calls
      expect(onExit).toHaveBeenCalledTimes(1);
    });

    it('mock-4: kill after normal exit on MockProcessHandle is a no-op', async () => {
      mock.onCommand('quick', { stdoutChunks: ['fast'], exitCode: 0 });
      const onExit = vi.fn();
      const handle = mock.spawnStream('quick', [], { onExit });

      const res = await handle.wait();
      expect(res.exitCode).toBe(0);
      expect(onExit).toHaveBeenCalledWith(0, null);

      // Kill after completed
      await handle.kill('SIGKILL');
      await handle.kill('SIGTERM');

      const res2 = await handle.wait();
      expect(res2.exitCode).toBe(0); // Exit code remains 0, not overwritten by kill
      expect(onExit).toHaveBeenCalledTimes(1); // Not called again
    });

    it('mock-5: interleaved stdout and stderr chunks and non-zero exit code', async () => {
      const stdoutEvents: string[] = [];
      const stderrEvents: string[] = [];
      const onExit = vi.fn();

      mock.onCommand('mixed', {
        stdoutChunks: ['chunk-1\n', 'chunk-2\n'],
        stderrChunks: ['warning: fallback\n', 'error: cannot fetch\n'],
        exitCode: 2,
      });

      const handle = mock.spawnStream('mixed', [], {
        onStdoutChunk: (c) => stdoutEvents.push(c),
        onStderrChunk: (c) => stderrEvents.push(c),
        onExit,
      });

      const res = await handle.wait();
      expect(res.exitCode).toBe(2);
      expect(res.stdout).toBe('chunk-1\nchunk-2\n');
      expect(res.stderr).toBe('warning: fallback\nerror: cannot fetch\n');
      expect(stdoutEvents).toEqual(['chunk-1\n', 'chunk-2\n']);
      expect(stderrEvents).toEqual(['warning: fallback\n', 'error: cannot fetch\n']);
      expect(onExit).toHaveBeenCalledWith(2, null);
    });

    it('mock-6: delayed stream with SIGTERM exitCode 143', async () => {
      mock.onCommand('delay-term', {
        stdoutChunks: ['c1', 'c2', 'c3'],
        delayMs: 40,
      });

      const onExit = vi.fn();
      const handle = mock.spawnStream('delay-term', [], { onExit });

      await new Promise((r) => setTimeout(r, 60));
      await handle.kill('SIGTERM');

      const res = await handle.wait();
      expect(res.exitCode).toBe(143);
      expect(onExit).toHaveBeenCalledWith(143, 'SIGTERM');
    });

    it('mock-7: queueResponse precedence over registered rules and defaultResponse', async () => {
      mock.setDefaultResponse({ stdoutChunks: ['default'], exitCode: 0 });
      mock.onCommand('target', { stdoutChunks: ['rule'], exitCode: 0 });
      mock.queueResponse({ stdoutChunks: ['queued-1'], exitCode: 0 });
      mock.queueResponse({ stdoutChunks: ['queued-2'], exitCode: 0 });

      const r1 = await mock.exec('target', []);
      const r2 = await mock.exec('target', []);
      const r3 = await mock.exec('target', []);
      const r4 = await mock.exec('other', []);

      expect(r1.stdout).toBe('queued-1');
      expect(r2.stdout).toBe('queued-2');
      expect(r3.stdout).toBe('rule');
      expect(r4.stdout).toBe('default');
    });

    it('mock-8: rule with times limit expires and falls back to defaultResponse', async () => {
      mock.setDefaultResponse({ stdoutChunks: ['fallback'], exitCode: 0 });
      mock.onCommand('expiring', { stdoutChunks: ['once'], exitCode: 0 }, 1);

      const r1 = await mock.exec('expiring', []);
      const r2 = await mock.exec('expiring', []);

      expect(r1.stdout).toBe('once');
      expect(r2.stdout).toBe('fallback');
    });

    it('mock-9: dynamic response function receives command and args', async () => {
      mock.onCommand('calc', (cmd, args) => ({
        stdoutChunks: [`result: ${args.join('+')}`],
        exitCode: 0,
      }));

      const res = await mock.exec('calc', ['1', '2', '3']);
      expect(res.stdout).toBe('result: 1+2+3');
    });

    it('mock-10: special characters, null bytes, unicode, and empty strings in chunks', async () => {
      const specialPayload = '🎉 Unicode \u0000 Null Byte \r\n Linebreak \t Tab 🚀';
      mock.onCommand('special', {
        stdoutChunks: [specialPayload, ''],
        stderrChunks: ['🔥 Special stderr'],
        exitCode: 0,
      });

      const res = await mock.exec('special', []);
      expect(res.stdout).toBe(specialPayload);
      expect(res.stderr).toBe('🔥 Special stderr');
    });

    it('mock-11: MockProcessHandle.kill with SIGINT normalizes exitCode to 130', async () => {
      mock.onCommand('sigint-test', {
        stdoutChunks: ['waiting'],
        delayMs: 100,
      });

      const handle = mock.spawnStream('sigint-test', []);
      await new Promise((r) => setTimeout(r, 20));
      await handle.kill('SIGINT');

      const res = await handle.wait();
      expect(res.exitCode).toBe(130);
    });

    it('mock-12: strict mode spawnStream rejects wait() and invokes onError', async () => {
      mock.setStrict(true);
      const onError = vi.fn();
      const handle = mock.spawnStream('unregistered-cmd', [], { onError });

      await expect(handle.wait()).rejects.toThrow(/MockProcessRunner \[STRICT\]/);
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError.mock.calls[0][0].message).toContain('unregistered-cmd');
    });
  });
});
