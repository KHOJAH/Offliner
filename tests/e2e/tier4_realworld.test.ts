// @vitest-environment jsdom
/**
 * tests/e2e/tier4_realworld.test.ts
 * Milestone 5 Tier 4: Real-World Application Workloads Suite (5 comprehensive scenarios)
 * Strictly fulfills TEST_INFRA.md end-to-end user workflow specifications.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestHarness } from '../mocks/mockHarness';
import {
  MOCK_SINGLE_VIDEO_METADATA,
  MOCK_PLAYLIST_METADATA,
} from '../mocks/fixtures/mediaFixtures';
import { buildDownloadArgs } from '@/engine/ytdlp/builder';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner } from '@/engine/runner/mock';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore, THEME_TOKENS } from '@/renderer/stores/themeStore';
import { ipcClient } from '@/renderer/ipc/client';
import { setupLocalStorageMock } from '../helpers/themeMocks';
import type { DownloadConfig, DownloadItem } from '@/types';

describe('Tier 4: Real-World Application Scenarios Suite (5 Scenarios)', () => {
  let harness: TestHarness;
  let unhandledRejections: any[] = [];
  let rejectionHandler: (err: any) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    unhandledRejections = [];
    rejectionHandler = (event: any) => {
      unhandledRejections.push(event?.reason || event);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', rejectionHandler);
    }
    process.on('unhandledRejection', rejectionHandler);

    harness = new TestHarness({ concurrency: 2 });
  });

  afterEach(async () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', rejectionHandler);
    }
    process.removeListener('unhandledRejection' as any, rejectionHandler);
    await harness.teardown();
  });

  // Scenario 1: Creator Snippet Extraction
  it('Scenario 1: Creator Snippet Extraction (Load video, 3 clips, keyframe cuts, queue execution)', async () => {
    // 1. Ingest documentary URL
    const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
    expect(meta.title).toBe(MOCK_SINGLE_VIDEO_METADATA.title);
    expect(meta.duration).toBe(360);

    // 2. Define 3 custom clip segments
    const clips = [
      { name: 'intro', start: 30, end: 60 },
      { name: 'highlight', start: 135, end: 225 },
      { name: 'outro', start: 240, end: 330 },
    ];

    // 3. Configure and verify CLI args for each clip
    const queuedIds: string[] = [];
    for (const c of clips) {
      const config: DownloadConfig = {
        url: meta.url,
        format: '137+140',
        videoFormat: 'mp4',
        clips: [c],
        outputPath: `/mock/downloads/docu_${c.name}.mp4`,
      };
      const args = buildDownloadArgs(config);
      expect(args).toContain('--force-keyframes-at-cuts');
      expect(args).toEqual(
        expect.arrayContaining(['--downloader-args', 'ffmpeg_i:-short_seek_size 1'])
      );
      expect(args).toContain(`*${c.start}-${c.end}`);

      const id = await ipcClient.addDownload(config);
      queuedIds.push(id);
    }

    expect(queuedIds).toHaveLength(3);

    // 4. Drain queue
    if (harness.queue.getStatus().active > 0 || harness.queue.getStatus().queued > 0) {
      await new Promise<void>((resolve) => harness.queue.once('queue:drained', () => resolve()));
    }

    // 5. Assert all 3 reached status 'done' with 100% progress
    for (const id of queuedIds) {
      const item = harness.queue.getItem(id);
      expect(item?.status).toBe('done');
      expect(item?.progress.percent).toBe(100);
    }
  });

  // Scenario 2: High-Fidelity Album Extraction
  it('Scenario 2: High-Fidelity Album Extraction (5-track playlist to FLAC Quality 0)', async () => {
    // 1. Ingest playlist
    const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
    expect(meta.is_playlist).toBe(true);
    const tracks = meta.entries || [];
    expect(tracks).toHaveLength(5);

    // 2. Batch configure FLAC Quality 0
    const queuedIds: string[] = [];
    for (const track of tracks) {
      const config: DownloadConfig & { extractAudio?: boolean } = {
        url: track.url,
        extractAudio: true,
        audioFormat: 'flac',
        audioQuality: 0,
        outputPath: `/mock/music/${track.id}.flac`,
        isPlaylist: true,
      };
      const args = buildDownloadArgs(config);
      expect(args).toEqual(
        expect.arrayContaining(['-x', '--audio-format', 'flac', '--audio-quality', '0', '--audio-multistreams'])
      );

      const id = await ipcClient.addDownload(config);
      queuedIds.push(id);
    }

    expect(queuedIds).toHaveLength(5);

    // Drain queue
    if (harness.queue.getStatus().active > 0 || harness.queue.getStatus().queued > 0) {
      await new Promise<void>((resolve) => harness.queue.once('queue:drained', () => resolve()));
    }

    for (const id of queuedIds) {
      const item = harness.queue.getItem(id);
      expect(item?.status).toBe('done');
      expect(item?.progress.percent).toBe(100);
    }
  });

  // Scenario 3: Throttled Queue Interruption
  it('Scenario 3: Throttled Queue Interruption (Concurrency 2, pause active, continue resume)', async () => {
    harness.delayMs = 50;
    const queue = harness.queue;
    queue.setConcurrency(2);

    // Enqueue 6 items
    const ids: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const id = `t4-throttled-${i}`;
      await queue.add({ id, url: `https://youtube.com/t4-${i}` });
      ids.push(id);
    }

    // Exactly 2 active, 4 queued
    expect(queue.getStatus().active).toBe(2);
    expect(queue.getStatus().queued).toBe(4);

    // Pause item 1 mid-download
    await queue.pause(ids[0]);
    expect(queue.getItem(ids[0])?.status).toBe('paused');

    // Slot freed -> item 3 is promoted to downloading
    expect(queue.getStatus().active).toBe(2);
    expect(queue.getItem(ids[2])?.status).toBe('downloading');

    // Resume item 1 -> re-enters pending as prioritized queued item
    await queue.resume(ids[0]);
    expect(queue.getItem(ids[0])?.status).toBe('queued');

    // Wait for queue to drain
    if (queue.getStatus().active > 0 || queue.getStatus().queued > 0) {
      await new Promise<void>((resolve) => queue.once('queue:drained', () => resolve()));
    }

    expect(queue.getStatus().active).toBe(0);
    expect(queue.getStatus().done).toBe(6);
  });

  // Scenario 4: Studio Focus Night Shift
  it('Scenario 4: Studio Focus Night Shift (Light -> Monochrome -> Dark token & contrast verification)', async () => {
    const storageCtrl = setupLocalStorageMock();
    const { setTheme } = useThemeStore.getState();

    // 1. Daylight (Light Mode)
    await setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().tokens.bgApp).toBe('#FAFAF8');
    expect(useThemeStore.getState().tokens.accent).toBe('#0071E3');

    // 2. Focus Shift (Monochrome Noir)
    await setTheme('monochrome');
    expect(useThemeStore.getState().theme).toBe('monochrome');
    expect(useThemeStore.getState().tokens.bgApp).toBe('#000000');
    expect(useThemeStore.getState().tokens.textPrimary).toBe('#FFFFFF');
    expect(useThemeStore.getState().tokens.accent).toBe('#FFFFFF');

    // 3. Obsidian (Dark Mode)
    await setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().tokens.bgApp).toBe('#0D0E11');
    expect(useThemeStore.getState().tokens.accent).toBe('#2997FF');

    // Rehydration check
    storageCtrl.getStore()['offliner_theme'] = 'monochrome';
    const { initTheme } = useThemeStore.getState();
    await initTheme();
    expect(useThemeStore.getState().theme).toBe('monochrome');
    storageCtrl.clearStore();
  });

  // Scenario 5: Storage Cleanup & External File Recovery
  it('Scenario 5: Storage Cleanup & External File Recovery (External deletion poller + purge)', async () => {
    const { addDownload, verifyDownloads, clearFinishedDownloads } = useDownloadStore.getState();

    // 1. Record 3 finished downloads
    const items: DownloadItem[] = [
      {
        id: 'rec-1',
        url: 'https://youtube.com/rec1',
        title: 'Video 1',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/mock/downloads/video1.mp4',
        createdAt: 1,
        config: { url: 'rec1' },
      },
      {
        id: 'rec-2',
        url: 'https://youtube.com/rec2',
        title: 'Video 2',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/mock/downloads/video2.mp4',
        createdAt: 2,
        config: { url: 'rec2' },
      },
      {
        id: 'rec-3',
        url: 'https://youtube.com/rec3',
        title: 'Video 3',
        thumbnail: '',
        status: 'done',
        progress: 100,
        filePath: '/mock/downloads/video3.mp4',
        createdAt: 3,
        config: { url: 'rec3' },
      },
    ];

    items.forEach((item) => addDownload(item));
    harness.mockFileSystem.add('/mock/downloads/video1.mp4');
    harness.mockFileSystem.add('/mock/downloads/video2.mp4');
    harness.mockFileSystem.add('/mock/downloads/video3.mp4');

    expect(useDownloadStore.getState().downloads.size).toBe(3);

    // 2. Simulate external deletion of video2
    harness.mockFileSystem.delete('/mock/downloads/video2.mp4');

    // 3. Trigger 30s background poller
    await verifyDownloads();

    // video2 should be marked cancelled; video1 and video3 remain done
    const store = useDownloadStore.getState().downloads;
    expect(store.get('rec-2')?.status).toBe('cancelled');
    expect(store.get('rec-1')?.status).toBe('done');
    expect(store.get('rec-3')?.status).toBe('done');

    // 4. Purge finished downloads
    clearFinishedDownloads();

    // All done/cancelled items are cleaned
    expect(useDownloadStore.getState().downloads.size).toBe(0);
  });
});
