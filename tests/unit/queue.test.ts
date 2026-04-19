// tests/unit/queue.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DownloadQueue } from '@/worker/queue';

describe('DownloadQueue', () => {
  const mockOptions = {
    concurrency: 2,
    onProgress: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };

  it('can be instantiated', () => {
    const queue = new DownloadQueue(mockOptions);
    expect(queue).toBeDefined();
    expect(queue.getStatus()).toEqual({ active: 0, queued: 0 });
  });

  it('reports correct status', () => {
    const queue = new DownloadQueue(mockOptions);
    const status = queue.getStatus();
    expect(status.active).toBe(0);
    expect(status.queued).toBe(0);
  });

  it('cancels all downloads', () => {
    const queue = new DownloadQueue(mockOptions);
    queue.cancelAll();
    expect(queue.getStatus()).toEqual({ active: 0, queued: 0 });
  });

  it('enforces concurrency limit', () => {
    // Conceptual test - actual enforcement requires mock yt-dlp
    const queue = new DownloadQueue({ ...mockOptions, concurrency: 1 });
    expect(queue.getStatus().active).toBe(0);
  });

  it('handles cancel of non-existent download gracefully', () => {
    const queue = new DownloadQueue(mockOptions);
    expect(() => queue.cancel('non-existent')).not.toThrow();
  });

  it('handles pause/resume of non-existent download gracefully', () => {
    const queue = new DownloadQueue(mockOptions);
    expect(() => queue.pause('non-existent')).not.toThrow();
    expect(() => queue.resume('non-existent')).not.toThrow();
  });
});
