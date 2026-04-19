// tests/unit/types.test.ts
import { describe, it, expectTypeOf } from 'vitest';
import type {
  DownloadItem, DownloadConfig, ClipRange, Settings,
  VideoMetadata, FormatInfo, DownloadStatus, Toast,
  CommandMessage, EventMessage, QueueStatus, UpdateInfo,
} from '@/types';

describe('Type definitions', () => {
  it('DownloadStatus has correct union members', () => {
    const statuses: DownloadStatus[] = ['queued', 'downloading', 'paused', 'done', 'error', 'cancelled'];
    expectTypeOf(statuses).toMatchTypeOf<DownloadStatus[]>();
  });

  it('ClipRange requires name, start, end', () => {
    const clip: ClipRange = { name: 'intro', start: 0, end: 30 };
    expectTypeOf(clip.name).toBeString();
    expectTypeOf(clip.start).toBeNumber();
    expectTypeOf(clip.end).toBeNumber();
  });

  it('DownloadItem has all required fields', () => {
    const item: DownloadItem = {
      id: 'uuid-1',
      url: 'https://youtube.com/watch?v=abc',
      title: 'Test Video',
      thumbnail: 'https://i.ytimg.com/vi/abc/maxresdefault.jpg',
      status: 'downloading',
      progress: 45,
      speed: '1.2MiB/s',
      eta: '02:30',
      totalBytes: 10000000,
      downloadedBytes: 4500000,
      config: { url: 'https://youtube.com/watch?v=abc', format: '137+140' },
      createdAt: Date.now(),
    };
    expectTypeOf(item.id).toBeString();
    expectTypeOf(item.status).toMatchTypeOf<DownloadStatus>();
    expectTypeOf(item.config).toMatchTypeOf<DownloadConfig>();
  });

  it('Settings has correct defaults shape', () => {
    const settings: Settings = {
      downloadPath: 'C:/Downloads',
      defaultVideoFormat: 'mp4',
      defaultAudioFormat: 'mp3',
      defaultQuality: '1080p',
      concurrency: 3,
      autoUpdate: true,
      theme: 'glass',
      maxClipDuration: 3600,
    };
    expectTypeOf(settings.concurrency).toBeNumber();
    expectTypeOf(settings.theme).toMatchTypeOf<'light' | 'dark' | 'glass'>();
  });

  it('CommandMessage has valid actions', () => {
    const cmd: CommandMessage = {
      type: 'command',
      id: 'cmd-1',
      action: 'download',
      args: { url: 'https://youtube.com/watch?v=abc' },
    };
    expectTypeOf(cmd.type).toMatchTypeOf<'command'>();
    expectTypeOf(cmd.action).toMatchTypeOf<'download' | 'cancel' | 'pause' | 'resume' | 'metadata'>();
  });

  it('EventMessage supports all event types', () => {
    const progress: EventMessage = { type: 'event', action: 'progress', downloadId: 'd1', percent: 50 };
    const done: EventMessage = { type: 'event', action: 'done', downloadId: 'd1', filePath: '/path/to/file.mp4' };
    const error: EventMessage = { type: 'event', action: 'error', downloadId: 'd1', message: 'Network error' };
    const metadata: EventMessage = { type: 'event', action: 'metadata', downloadId: 'd1', data: {} };

    expectTypeOf(progress.action).toMatchTypeOf<'progress' | 'done' | 'error' | 'metadata'>();
  });
});
