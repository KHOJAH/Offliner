// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  RealProcessRunner,
  MockProcessRunner,
  getProcessRunner,
  setProcessRunner,
  createProcessRunner,
  mockYtDlpMetadata,
  mockYtDlpDownload,
  mockYtDlpError,
} from '@/engine/runner';

describe('IProcessRunner Engine Architecture', () => {
  describe('RealProcessRunner', () => {
    let runner: RealProcessRunner;

    beforeEach(() => {
      runner = new RealProcessRunner();
    });

    it('executes a command and returns stdout and exitCode 0', async () => {
      const res = await runner.exec(process.execPath, ['-e', 'process.stdout.write("hello world")']);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toBe('hello world');
      expect(res.stderr).toBe('');
    });

    it('returns non-zero exit code when process exits with code', async () => {
      const res = await runner.exec(process.execPath, ['-e', 'process.exit(42)']);
      expect(res.exitCode).toBe(42);
    });

    it('captures stderr correctly', async () => {
      const res = await runner.exec(process.execPath, ['-e', 'process.stderr.write("an error occurred")']);
      expect(res.exitCode).toBe(0);
      expect(res.stderr).toBe('an error occurred');
    });

    it('streams stdout chunks via spawnStream', async () => {
      const stdoutChunks: string[] = [];
      const onExit = vi.fn();

      const handle = runner.spawnStream(
        process.execPath,
        ['-e', 'console.log("chunk1"); console.log("chunk2");'],
        {
          onStdoutChunk: (chunk) => stdoutChunks.push(chunk),
          onExit,
        }
      );

      const result = await handle.wait();
      expect(result.exitCode).toBe(0);
      expect(stdoutChunks.join('')).toContain('chunk1');
      expect(stdoutChunks.join('')).toContain('chunk2');
      expect(onExit).toHaveBeenCalledWith(0, null);
    });

    it('terminates a running process via kill() and returns signal exitCode', async () => {
      const handle = runner.spawnStream(
        process.execPath,
        ['-e', 'setInterval(() => { process.stdout.write("tick\\n"); }, 100);']
      );

      expect(handle.pid).toBeDefined();

      // Wait 150ms then kill
      await new Promise((r) => setTimeout(r, 150));
      await handle.kill('SIGKILL');

      const result = await handle.wait();
      expect(result.exitCode).toBe(137);
    });

    it('handles spawn error for non-existent binary', async () => {
      const onError = vi.fn();
      const handle = runner.spawnStream('__definitely_non_existent_binary_xyz_123__', [], {
        onError,
      });

      await expect(handle.wait()).rejects.toThrow();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('MockProcessRunner', () => {
    let mock: MockProcessRunner;

    beforeEach(() => {
      mock = new MockProcessRunner();
    });

    afterEach(() => {
      mock.reset();
    });

    it('executes default response when no rules registered', async () => {
      const res = await mock.exec('yt-dlp', ['--version']);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toBe('');
      expect(mock.getInvocations()).toHaveLength(1);
    });

    it('matches exact command string rule', async () => {
      mock.onCommand('yt-dlp --version', {
        stdoutChunks: ['2026.11.01\n'],
        exitCode: 0,
      });

      const res = await mock.exec('yt-dlp', ['--version']);
      expect(res.stdout).toBe('2026.11.01\n');
      expect(res.exitCode).toBe(0);
    });

    it('matches regex command pattern', async () => {
      mock.onCommand(/--dump-single-json/, {
        stdoutChunks: ['{"title": "Test Video"}'],
        exitCode: 0,
      });

      const res = await mock.exec('yt-dlp', ['--dump-single-json', 'https://youtu.be/abc']);
      expect(res.stdout).toBe('{"title": "Test Video"}');
    });

    it('matches custom predicate rule', async () => {
      mock.onCommand(
        (cmd, args) => cmd === 'ffmpeg' && args.includes('-i'),
        {
          stderrChunks: ['frame= 100 fps=30\n'],
          exitCode: 0,
        }
      );

      const res = await mock.exec('ffmpeg', ['-i', 'input.mp4', 'output.mp3']);
      expect(res.stderr).toBe('frame= 100 fps=30\n');
    });

    it('consumes queued sequential responses', async () => {
      mock.queueResponse({ stdoutChunks: ['first call\n'], exitCode: 0 });
      mock.queueResponse({ stdoutChunks: ['second call\n'], exitCode: 0 });

      const res1 = await mock.exec('yt-dlp', ['url1']);
      const res2 = await mock.exec('yt-dlp', ['url2']);

      expect(res1.stdout).toBe('first call\n');
      expect(res2.stdout).toBe('second call\n');
    });

    it('streams chunks in order with onStdoutChunk callback', async () => {
      const received: string[] = [];
      const onExit = vi.fn();

      mock.onCommand('download', {
        stdoutChunks: ['line 1\n', 'line 2\n', 'line 3\n'],
        exitCode: 0,
      });

      const handle = mock.spawnStream('download', [], {
        onStdoutChunk: (c) => received.push(c),
        onExit,
      });

      const res = await handle.wait();
      expect(res.exitCode).toBe(0);
      expect(received).toEqual(['line 1\n', 'line 2\n', 'line 3\n']);
      expect(onExit).toHaveBeenCalledWith(0, null);
    });

    it('cancels delayed streaming mid-flight on kill()', async () => {
      const received: string[] = [];
      mock.onCommand('delayed', {
        stdoutChunks: ['chunk 1\n', 'chunk 2\n', 'chunk 3\n'],
        delayMs: 30,
        exitCode: 0,
      });

      const handle = mock.spawnStream('delayed', [], {
        onStdoutChunk: (c) => received.push(c),
      });

      // Kill before chunk 2 or 3 emit
      await new Promise((r) => setTimeout(r, 45));
      await handle.kill('SIGKILL');

      const res = await handle.wait();
      expect(res.exitCode).toBe(137);
      expect(received).toContain('chunk 1\n');
      expect(received).not.toContain('chunk 3\n');
    });

    it('injects spawn error and triggers onError callback', async () => {
      const err = new Error('Simulated binary failure');
      mock.onCommand('failing', { spawnError: err });

      const onError = vi.fn();
      const handle = mock.spawnStream('failing', [], { onError });

      await expect(handle.wait()).rejects.toThrow('Simulated binary failure');
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('enforces strict mode when unmatched command received', async () => {
      mock.setStrict(true);
      const handle = mock.spawnStream('unregistered', ['arg']);
      await expect(handle.wait()).rejects.toThrow('MockProcessRunner [STRICT]');
    });

    it('tracks invocations and enables history inspection', async () => {
      await mock.exec('yt-dlp', ['--format', 'best', 'https://video.url']);
      expect(mock.getInvocations()).toHaveLength(1);
      const inv = mock.getLastInvocation()!;
      expect(inv.command).toBe('yt-dlp');
      expect(inv.args).toEqual(['--format', 'best', 'https://video.url']);

      mock.clearInvocations();
      expect(mock.getInvocations()).toHaveLength(0);
    });

    it('supports pre-canned helpers for yt-dlp metadata, download, and error', async () => {
      const meta = mockYtDlpMetadata({ id: 'xyz', title: 'Video XYZ' });
      mock.onCommand('meta', meta);
      const resMeta = await mock.exec('meta', []);
      expect(JSON.parse(resMeta.stdout)).toEqual({ id: 'xyz', title: 'Video XYZ' });

      const dl = mockYtDlpDownload('/downloads/xyz.mp4', 2);
      mock.onCommand('dl', dl);
      const resDl = await mock.exec('dl', []);
      expect(resDl.stdout).toContain('[download] Destination: /downloads/xyz.mp4');
      expect(resDl.stdout).toContain('100% of');

      const err = mockYtDlpError('Video unavailable', 1);
      mock.onCommand('err', err);
      const resErr = await mock.exec('err', []);
      expect(resErr.stderr).toContain('ERROR: Video unavailable');
      expect(resErr.exitCode).toBe(1);
    });
  });

  describe('Dependency Injection & Factory', () => {
    it('creates Real and Mock process runners via createProcessRunner', () => {
      const real = createProcessRunner('real');
      expect(real).toBeInstanceOf(RealProcessRunner);

      const mock = createProcessRunner('mock');
      expect(mock).toBeInstanceOf(MockProcessRunner);
    });

    it('allows global runner swapping via setProcessRunner / getProcessRunner', () => {
      const original = getProcessRunner();
      const mock = new MockProcessRunner();
      setProcessRunner(mock);
      expect(getProcessRunner()).toBe(mock);
      setProcessRunner(original);
    });
  });
});
