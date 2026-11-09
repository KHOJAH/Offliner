import { describe, it, expect, beforeEach } from 'vitest';
import { MockProcessRunner } from '@/engine/runner';

describe('MockProcessRunner Rule Matcher Specificity & Formatting', () => {
  let mock: MockProcessRunner;

  beforeEach(() => {
    mock = new MockProcessRunner();
  });

  it('prioritizes specific full command rule over base rule regardless of registration order', async () => {
    // Order 1: Base first, specific second
    mock.onCommand('yt-dlp', { stdoutChunks: ['base\n'] });
    mock.onCommand('yt-dlp --dump-json', { stdoutChunks: ['json\n'] });

    const res1 = await mock.exec('yt-dlp', ['--dump-json']);
    expect(res1.stdout).toBe('json\n');

    // Order 2: Reverse registration
    mock.reset();
    mock.onCommand('yt-dlp --dump-json', { stdoutChunks: ['json\n'] });
    mock.onCommand('yt-dlp', { stdoutChunks: ['base\n'] });

    const res2 = await mock.exec('yt-dlp', ['--dump-json']);
    expect(res2.stdout).toBe('json\n');
  });

  it('falls back to base binary rule when specific rule does not match', async () => {
    mock.onCommand('yt-dlp', { stdoutChunks: ['base\n'] });
    mock.onCommand('yt-dlp --dump-json', { stdoutChunks: ['json\n'] });

    const res = await mock.exec('yt-dlp', ['--version']);
    expect(res.stdout).toBe('base\n');
  });

  it('prevents substring collisions on URL query params and numbered tokens', async () => {
    mock.setStrict(true);
    mock.onCommand('watch?v=1', { stdoutChunks: ['video1'] });
    mock.onCommand('cmd_3', { stdoutChunks: ['cmd3'] });

    // Must NOT match watch?v=1
    await expect(mock.exec('yt-dlp', ['https://youtube.com/watch?v=10'])).rejects.toThrow(
      /No mock response registered for "yt-dlp https:\/\/youtube.com\/watch\?v=10"/
    );

    // Must NOT match cmd_3
    await expect(mock.exec('cmd_30', [])).rejects.toThrow(
      /No mock response registered for "cmd_30"/
    );
  });

  it('matches exact commands with end anchors without trailing whitespace', async () => {
    mock.onCommand(/^yt-dlp$/, { stdoutChunks: ['version 1.0\n'] });
    const res = await mock.exec('yt-dlp', []);
    expect(res.stdout).toBe('version 1.0\n');
  });

  it('formats strict mode error messages cleanly without trailing space when args is empty', async () => {
    mock.setStrict(true);
    await expect(mock.exec('unregistered', [])).rejects.toThrow(
      'MockProcessRunner [STRICT]: No mock response registered for "unregistered"'
    );
  });
});
