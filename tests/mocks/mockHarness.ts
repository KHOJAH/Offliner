/**
 * tests/mocks/mockHarness.ts
 * Unified offline test harness linking React stores, IPC bridge,
 * DownloadQueueEngine, and MockProcessRunner.
 */

import { MockProcessRunner } from '@/engine/runner/mock';
import { setProcessRunner } from '@/engine/runner';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore } from '@/renderer/stores/themeStore';
import { useUIStore } from '@/renderer/stores/uiStore';
import {
  MOCK_SINGLE_VIDEO_METADATA,
  MOCK_PLAYLIST_METADATA,
  MOCK_STREAM_CHUNKS,
} from './fixtures/mediaFixtures';
import type { DownloadConfig, DownloadItem, EventMessage, Settings } from '@/types';

export interface HarnessOptions {
  concurrency?: number;
  delayMs?: number;
}

export class TestHarness {
  public runner: MockProcessRunner;
  public queue: DownloadQueueEngine;
  public delayMs: number = 0;
  private progressListeners: Set<(ev: EventMessage) => void> = new Set();
  private doneListeners: Set<(ev: EventMessage) => void> = new Set();
  private errorListeners: Set<(ev: EventMessage) => void> = new Set();
  private metadataListeners: Set<(ev: EventMessage) => void> = new Set();
  private updateReadyListeners: Set<(info: { version: string; releaseNotes?: string }) => void> = new Set();
  public mockFileSystem: Set<string> = new Set();
  private savedDownloads: DownloadItem[] = [];

  constructor(options: HarnessOptions = {}) {
    this.delayMs = options.delayMs ?? 0;
    this.runner = new MockProcessRunner();
    setProcessRunner(this.runner);

    // Register default yt-dlp metadata rule
    this.runner.onCommand(/--dump-json|--dump-single-json/, (_cmd, args) => {
      const url = args[args.length - 1] || '';
      if (url.includes('list=') || url.includes('playlist')) {
        return { stdoutChunks: [JSON.stringify(MOCK_PLAYLIST_METADATA)], exitCode: 0 };
      }
      return { stdoutChunks: [JSON.stringify(MOCK_SINGLE_VIDEO_METADATA)], exitCode: 0 };
    });

    // Register default download rule
    this.runner.onCommand(/yt-dlp/, (_cmd, args) => {
      const outIdx = args.indexOf('--output');
      const outPath = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : '/mock/downloads/video.mp4';
      this.mockFileSystem.add(outPath);
      return {
        stdoutChunks: MOCK_STREAM_CHUNKS.videoDownload(outPath),
        exitCode: 0,
        delayMs: this.delayMs,
      };
    });

    this.queue = new DownloadQueueEngine({
      runner: this.runner,
      concurrency: options.concurrency ?? 3,
      onProgress: (id, prog) => {
        const ev: EventMessage = {
          type: 'event',
          action: 'progress',
          downloadId: id,
          percent: prog.percent,
          speed: prog.speed,
          speedBps: prog.speedBps,
          eta: prog.eta,
          etaSeconds: prog.etaSeconds,
          totalBytes: prog.totalBytes,
          downloadedBytes: prog.downloadedBytes,
        };
        this.progressListeners.forEach((fn) => fn(ev));
      },
      onDone: (id, filePath) => {
        const ev: EventMessage = {
          type: 'event',
          action: 'done',
          downloadId: id,
          filePath,
        };
        this.doneListeners.forEach((fn) => fn(ev));
      },
      onError: (id, message) => {
        const ev: EventMessage = {
          type: 'event',
          action: 'error',
          downloadId: id,
          message,
        };
        this.errorListeners.forEach((fn) => fn(ev));
      },
    });

    this.bridgeElectronAPI();
  }

  private bridgeElectronAPI(): void {
    (window as any).electronAPI = {
      getMetadata: async (url: string) => {
        if (!url || !url.trim()) throw new Error('Invalid URL');
        if (url.includes('unavailable') || url.includes('404')) {
          throw new Error('Video unavailable');
        }
        if (url.includes('list=') || url.includes('playlist')) {
          return MOCK_PLAYLIST_METADATA;
        }
        return MOCK_SINGLE_VIDEO_METADATA;
      },
      addDownload: async (cfg: DownloadConfig) => {
        const id = (cfg as any).id || `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        await this.queue.add({
          id,
          url: cfg.url,
          format: cfg.format,
          videoFormat: cfg.videoFormat,
          outputPath: cfg.outputPath,
          audioFormat: cfg.audioFormat,
          audioQuality: cfg.audioQuality,
          clips: cfg.clips,
          extractAudio: !!cfg.audioFormat,
          isPlaylist: cfg.isPlaylist,
        });
        return id;
      },
      pauseDownload: async (id: string) => {
        await this.queue.pause(id);
      },
      resumeDownload: async (id: string) => {
        await this.queue.resume(id);
      },
      cancelDownload: async (id: string) => {
        await this.queue.cancel(id);
      },
      getSettings: async () => ({
        downloadPath: '/mock/downloads',
        defaultVideoFormat: '137+140',
        defaultAudioFormat: 'mp3',
        defaultQuality: '1080p',
        concurrency: this.queue.getConcurrency(),
        autoUpdate: true,
        theme: useThemeStore.getState().theme,
        maxClipDuration: 3600,
      }),
      updateSettings: async (partial: Partial<Settings>) => {
        if (partial.concurrency !== undefined) {
          this.queue.setConcurrency(partial.concurrency);
        }
        useSettingsStore.setState((prev) => ({ ...prev, ...partial }));
      },
      loadDownloads: async () => this.savedDownloads,
      saveDownloads: async (downloads: DownloadItem[]) => {
        this.savedDownloads = downloads;
      },
      selectDownloadPath: async () => '/mock/downloads',
      checkForUpdates: async () => null,
      getVersion: async () => '1.1.1',
      openFile: async (path: string) => {
        if (!this.mockFileSystem.has(path)) throw new Error('File not found');
      },
      showInFolder: async (path: string) => {
        if (!this.mockFileSystem.has(path)) throw new Error('File not found');
      },
      fileExists: async (path: string) => this.mockFileSystem.has(path),
      deleteFile: async (path: string) => {
        return this.mockFileSystem.delete(path);
      },
      onDownloadProgress: (cb: (ev: EventMessage) => void) => {
        this.progressListeners.add(cb);
      },
      onDownloadDone: (cb: (ev: EventMessage) => void) => {
        this.doneListeners.add(cb);
      },
      onDownloadError: (cb: (ev: EventMessage) => void) => {
        this.errorListeners.add(cb);
      },
      onDownloadMetadata: (cb: (ev: EventMessage) => void) => {
        this.metadataListeners.add(cb);
      },
      onUpdateReady: (cb: (info: { version: string; releaseNotes?: string }) => void) => {
        this.updateReadyListeners.add(cb);
      },
      platform: 'linux',
    };
  }

  public async teardown(): Promise<void> {
    await this.queue.cancelAll();
    this.progressListeners.clear();
    this.doneListeners.clear();
    this.errorListeners.clear();
    this.metadataListeners.clear();
    this.updateReadyListeners.clear();
    this.mockFileSystem.clear();
    this.savedDownloads = [];
    this.runner.reset();

    // Reset Zustand stores
    useDownloadStore.setState({ downloads: new Map() });
    useSettingsStore.setState({
      downloadPath: '/mock/downloads',
      concurrency: 3,
      theme: 'dark',
      defaultVideoFormat: '137+140',
      defaultAudioFormat: 'mp3',
      defaultQuality: '1080p',
      autoUpdate: true,
      maxClipDuration: 3600,
    });
    useThemeStore.setState({ theme: 'dark', preference: 'system' });
    useUIStore.setState({ toasts: [], activeTab: '/' });
  }
}
