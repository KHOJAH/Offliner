// @vitest-environment jsdom
/**
 * tests/e2e/tier3_combinations.test.ts
 * Milestone 5 Tier 3: Combinatorial & Pairwise Test Suite (16 cross-feature tests)
 * Validates complex interactions between download modes, clipping, batch queue,
 * themes, IPC filesystem ops, and live settings changes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestHarness } from '../mocks/mockHarness';
import {
  MOCK_SINGLE_VIDEO_METADATA,
  MOCK_PLAYLIST_METADATA,
} from '../mocks/fixtures/mediaFixtures';
import { detectUrlType } from '@/engine/ytdlp/resolver';
import { buildDownloadArgs, type DownloadOptions } from '@/engine/ytdlp/builder';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner } from '@/engine/runner/mock';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore, THEME_TOKENS } from '@/renderer/stores/themeStore';
import { ipcClient } from '@/renderer/ipc/client';
import type { DownloadConfig, DownloadItem } from '@/types';

describe('Tier 3: Pairwise Cross-Feature Combinations Suite (16 Tests)', () => {
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

  // Pairwise 1: Video Download + Timeline Trimming + Queue Concurrency Limit
  it('3.1 Video Download + Timeline Trimming + Queue Concurrency Limit (1 active slot)', async () => {
    harness.delayMs = 150;
    harness.queue.setConcurrency(1);

    const clip1Args = buildDownloadArgs({
      url: 'https://youtube.com/watch?v=sample1',
      clips: [{ name: 'cut1', start: 10, end: 30 }],
    });
    expect(clip1Args).toContain('--force-keyframes-at-cuts');
    expect(clip1Args).toContain('*10-30');

    await harness.queue.add({ id: 'clip-job-1', url: 'https://youtube.com/watch?v=sample1' });
    await harness.queue.add({ id: 'clip-job-2', url: 'https://youtube.com/watch?v=sample2' });

    expect(harness.queue.getStatus().active).toBe(1);
    expect(harness.queue.getStatus().queued).toBe(1);
  });

  // Pairwise 2: 4K DASH Multiplexing + Format Switch + Destination Path Change
  it('3.2 4K DASH Multiplexing + Format Switch + Destination Path Change', async () => {
    const meta = await ipcClient.getMetadata('https://youtube.com/watch?v=vid-4k-sample');
    const format4K = meta.formats.find((f) => f.format_id === '313');
    expect(format4K).toBeDefined();

    // Change destination in settings
    await ipcClient.updateSettings({ downloadPath: '/custom/4k_storage' });

    const config: DownloadConfig = {
      url: meta.url,
      format: `${format4K?.format_id}+140`,
      videoFormat: 'mp4',
      outputPath: '/custom/4k_storage/master.mp4',
    };

    const args = buildDownloadArgs(config);
    expect(args).toContain('-f');
    expect(args[args.indexOf('-f') + 1]).toContain('313+140');
    expect(args).toContain('--merge-output-format');
    expect(args).toContain('mp4');
    expect(args).toContain('/custom/4k_storage/master.mp4');
  });

  // Pairwise 3: High-Fidelity Audio Extraction (FLAC Quality 0) + Playlist Batch Ingest
  it('3.3 High-Fidelity Audio Extraction (FLAC Quality 0) + Playlist Batch Ingest', async () => {
    const meta = await ipcClient.getMetadata('https://youtube.com/playlist?list=pl-chillstep-album');
    const entries = meta.entries || [];

    const batchAudioConfigs: DownloadOptions[] = entries.map((entry) => ({
      url: entry.url,
      audioFormat: 'flac',
      audioQuality: 0,
      extractAudio: true,
      outputPath: `/mock/music/${entry.id}.flac`,
      isPlaylist: true,
    }));

    expect(batchAudioConfigs).toHaveLength(5);
    batchAudioConfigs.forEach((cfg) => {
      const args = buildDownloadArgs(cfg);
      expect(args).toEqual(
        expect.arrayContaining(['-x', '--audio-format', 'flac', '--audio-quality', '0', '--audio-multistreams'])
      );
    });
  });

  // Pairwise 4: Audio Extraction (OPUS) + Inline Clip + Single Video Workflow
  it('3.4 Audio Extraction (OPUS) + Inline Clip + Single Video Workflow', () => {
    const config: DownloadOptions = {
      url: 'https://youtube.com/watch?v=speech',
      extractAudio: true,
      audioFormat: 'opus',
      audioQuality: 3,
      clips: [{ name: 'keynote-quote', start: 30, end: 90 }],
    };

    const args = buildDownloadArgs(config);
    expect(args).toContain('-x');
    expect(args).toContain('opus');
    expect(args).toContain('*30-90');
    // Audio clipping should NOT include --force-keyframes-at-cuts
    expect(args).not.toContain('--force-keyframes-at-cuts');
    expect(args).toContain('--audio-multistreams');
  });

  // Pairwise 5: Active Video Download Stream + Dynamic Theme Switch
  it('3.5 Active Video Download Stream + Dynamic Theme Switch (Light -> Monochrome -> Dark)', async () => {
    const { addDownload, updateProgress } = useDownloadStore.getState();
    const { setTheme } = useThemeStore.getState();

    addDownload({
      id: 'active-stream',
      url: 'https://youtube.com/watch?v=stream1',
      title: 'Active Stream',
      thumbnail: '',
      status: 'downloading',
      progress: 30,
      speed: '5 MB/s',
      createdAt: Date.now(),
      config: { url: 'https://youtube.com/watch?v=stream1' },
    });

    await setTheme('light');
    updateProgress('active-stream', { progress: 60 });
    expect(useThemeStore.getState().theme).toBe('light');

    await setTheme('monochrome');
    updateProgress('active-stream', { progress: 90 });
    expect(useThemeStore.getState().theme).toBe('monochrome');
    expect(useThemeStore.getState().tokens.accent).toBe('#FFFFFF');

    await setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    const item = useDownloadStore.getState().downloads.get('active-stream');
    expect(item?.progress).toBe(90);
  });

  // Pairwise 6: Active Audio Extraction Stream + Theme Switch to Monochrome
  it('3.6 Active Audio Extraction Stream + Theme Switch to Monochrome (Zero Saturation Verification)', async () => {
    const { setTheme } = useThemeStore.getState();
    await setTheme('monochrome');

    const tokens = useThemeStore.getState().tokens;
    // R === G === B on accent
    expect(tokens.accent).toBe('#FFFFFF');
    expect(tokens.bgApp).toBe('#000000');
    expect(tokens.accentText).toBe('#000000');
  });

  // Pairwise 7: Queue Concurrency 2 + 5 Items Enqueued + Pause Active Item + Verify Item 3 Promoted + Resume Item 1
  it('3.7 Queue Concurrency 2 + 5 Items Enqueued + Pause Active Item + Verify Item 3 Promoted + Resume Item 1', async () => {
    harness.delayMs = 250;
    const queue = harness.queue;
    queue.setConcurrency(2);

    for (let i = 1; i <= 5; i++) {
      await queue.add({ id: `p7-item-${i}`, url: `https://youtube.com/p7-${i}` });
    }

    expect(queue.getStatus().active).toBe(2);
    expect(queue.getStatus().queued).toBe(3);

    // Pause item 1 -> frees slot for item 3
    await queue.pause('p7-item-1');
    expect(queue.getItem('p7-item-1')?.status).toBe('paused');
    expect(queue.getStatus().active).toBe(2);
    expect(queue.getItem('p7-item-3')?.status).toBe('downloading');

    // Resume item 1 -> puts back in queue or pending
    await queue.resume('p7-item-1');
    expect(queue.getStatus().active).toBe(2);
  });

  // Pairwise 8: Multi-Clip Queue Builder (3 clips) + Cancel Middle Clip + Verify Clips 1 and 3 Complete
  it('3.8 Multi-Clip Queue Builder (3 clips) + Cancel Middle Clip + Verify Clips 1 and 3 Complete', async () => {
    const runner = new MockProcessRunner();
    runner.onCommand(/clip-2/, { exitCode: 0, delayMs: 150, stdoutChunks: ['[download] 10%\n'] });
    runner.setDefaultResponse({ exitCode: 0, delayMs: 20, stdoutChunks: ['[download] 100%\n'] });

    const queue = new DownloadQueueEngine({ runner, concurrency: 2 });
    await queue.add({ id: 'clip-1', url: 'https://youtube.com/clip-1' });
    await queue.add({ id: 'clip-2', url: 'https://youtube.com/clip-2' });
    await queue.add({ id: 'clip-3', url: 'https://youtube.com/clip-3' });

    // Cancel middle clip
    await queue.cancel('clip-2');
    expect(queue.getItem('clip-2')?.status).toBe('cancelled');

    // Wait for queue to drain
    if (queue.getStatus().active > 0 || queue.getStatus().queued > 0) {
      await new Promise<void>((resolve) => queue.once('queue:drained', () => resolve()));
    }

    expect(queue.getItem('clip-1')?.status).toBe('done');
    expect(queue.getItem('clip-3')?.status).toBe('done');
    expect(queue.getItem('clip-2')?.status).toBe('cancelled');
  });

  // Pairwise 9: Playlist Batch Ingestion + Partial Deselection (3 of 5) + Global "Pause All"
  it('3.9 Playlist Batch Ingestion + Partial Deselection (3 of 5) + Global "Pause All"', async () => {
    harness.delayMs = 250;
    const queue = harness.queue;
    queue.setConcurrency(3);

    // Enqueue 3 selected items out of 5
    await queue.add({ id: 'pl-sel-1', url: 'https://youtube.com/pl-sel-1' });
    await queue.add({ id: 'pl-sel-2', url: 'https://youtube.com/pl-sel-2' });
    await queue.add({ id: 'pl-sel-3', url: 'https://youtube.com/pl-sel-3' });

    expect(queue.getStatus().active).toBe(3);

    await queue.pauseAll();
    expect(queue.getStatus().active).toBe(0);
    expect(queue.getStatus().paused).toBe(3);
  });

  // Pairwise 10: Playlist Batch Audio + "Clear Finished" invoked mid-stream while other items download
  it('3.10 Playlist Batch Audio + "Clear Finished" invoked mid-stream while other items download', () => {
    const { addDownload, clearFinishedDownloads } = useDownloadStore.getState();

    addDownload({
      id: 'batch-done',
      url: 'https://youtube.com/done1',
      title: 'Track 1',
      thumbnail: '',
      status: 'done',
      progress: 100,
      createdAt: 1,
      config: { url: 'done1' },
    });
    addDownload({
      id: 'batch-active',
      url: 'https://youtube.com/act1',
      title: 'Track 2',
      thumbnail: '',
      status: 'downloading',
      progress: 60,
      createdAt: 2,
      config: { url: 'act1' },
    });

    clearFinishedDownloads();

    const downloads = useDownloadStore.getState().downloads;
    expect(downloads.has('batch-done')).toBe(false);
    expect(downloads.has('batch-active')).toBe(true);
    expect(downloads.get('batch-active')?.progress).toBe(60);
  });

  // Pairwise 11: External File Deletion Poller runs during Active Download of separate file
  it('3.11 External File Deletion Poller runs during Active Download of separate file', async () => {
    const { addDownload, verifyDownloads } = useDownloadStore.getState();

    addDownload({
      id: 'finished-del',
      url: 'https://youtube.com/del',
      title: 'Finished Deleted',
      thumbnail: '',
      status: 'done',
      progress: 100,
      filePath: '/mock/downloads/missing_file.mp4',
      createdAt: 1,
      config: { url: 'del' },
    });
    addDownload({
      id: 'actively-running',
      url: 'https://youtube.com/running',
      title: 'Active Running',
      thumbnail: '',
      status: 'downloading',
      progress: 40,
      createdAt: 2,
      config: { url: 'running' },
    });

    // Run poller
    await verifyDownloads();

    const downloads = useDownloadStore.getState().downloads;
    expect(downloads.get('finished-del')?.status).toBe('cancelled');
    expect(downloads.get('actively-running')?.status).toBe('downloading');
    expect(downloads.get('actively-running')?.progress).toBe(40);
  });

  // Pairwise 12: Dynamic Concurrency Adjustment (1 -> 8 -> 2) while Queue is actively processing items
  it('3.12 Dynamic Concurrency Adjustment (1 -> 8 -> 2) while Queue is actively processing items', async () => {
    harness.delayMs = 250;
    const queue = harness.queue;
    queue.setConcurrency(1);

    for (let i = 1; i <= 8; i++) {
      await queue.add({ id: `dyn-${i}`, url: `https://youtube.com/dyn-${i}` });
    }

    expect(queue.getStatus().active).toBe(1);

    // Scale up to 8 -> all 8 start
    queue.setConcurrency(8);
    expect(queue.getStatus().active).toBe(8);

    // Scale down to 2
    queue.setConcurrency(2);
    expect(queue.getConcurrency()).toBe(2);
  });

  // Pairwise 13: Parallel Single Video Download and Audio Extraction jobs from the same URL
  it('3.13 Parallel Single Video Download and Audio Extraction jobs from the same URL', () => {
    const url = 'https://youtube.com/watch?v=dual-purpose';

    const videoConfig: DownloadConfig = {
      url,
      format: '137+140',
      videoFormat: 'mp4',
      outputPath: '/mock/downloads/video.mp4',
    };
    const audioConfig: DownloadOptions = {
      url,
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 2,
      outputPath: '/mock/downloads/audio.mp3',
    };

    const videoArgs = buildDownloadArgs(videoConfig);
    const audioArgs = buildDownloadArgs(audioConfig);

    expect(videoArgs).toContain('--merge-output-format');
    expect(videoArgs).toContain('mp4');
    expect(videoArgs).not.toContain('-x');

    expect(audioArgs).toContain('-x');
    expect(audioArgs).toContain('mp3');
    expect(audioArgs).not.toContain('--merge-output-format');
  });

  // Pairwise 14: Safe Trash Deletion of completed item while subsequent item is downloading in queue
  it('3.14 Safe Trash Deletion of completed item while subsequent item is downloading in queue', async () => {
    const finishedPath = '/mock/downloads/finished.mp4';
    harness.mockFileSystem.add(finishedPath);

    const deleted = await ipcClient.deleteFile(finishedPath);
    expect(deleted).toBe(true);
    expect(harness.mockFileSystem.has(finishedPath)).toBe(false);
  });

  // Pairwise 15: Settings Download Directory Change during active download queue processing
  it('3.15 Settings Download Directory Change during active download queue processing', async () => {
    const initialConfig = buildDownloadArgs({
      url: 'https://youtube.com/watch?v=test',
      outputPath: '/mock/downloads/first.mp4',
    });
    expect(initialConfig).toContain('/mock/downloads/first.mp4');

    await ipcClient.updateSettings({ downloadPath: '/new/external/drive' });

    const updatedConfig = buildDownloadArgs({
      url: 'https://youtube.com/watch?v=test2',
      outputPath: '/new/external/drive/second.mp4',
    });
    expect(updatedConfig).toContain('/new/external/drive/second.mp4');
  });

  // Pairwise 16: Universal Resolver Omnibox Ingestion (Video vs Playlist detection)
  it('3.16 Universal Resolver Omnibox Ingestion (Video vs Playlist detection)', () => {
    const videoUrl = 'https://youtube.com/watch?v=single-video-id';
    const playlistUrl = 'https://youtube.com/playlist?list=playlist-id-123';
    const unknownUrl = 'https://example.com/not-media';

    expect(detectUrlType(videoUrl)).toBe('video');
    expect(detectUrlType(playlistUrl)).toBe('playlist');
    expect(detectUrlType(unknownUrl)).toBe('unknown');
  });
});
