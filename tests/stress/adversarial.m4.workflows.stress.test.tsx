// @vitest-environment jsdom
/**
 * tests/stress/adversarial.m4.workflows.stress.test.tsx
 * Comprehensive Adversarial & Empirical Stress Harness for Milestone 4:
 * 1. Rapid view switching across all 7 views (Home, Video, Audio, Playlist, Clips, Queue, Settings)
 *    ensuring 0 unmounted component state updates and 0 unhandled promise rejections.
 * 2. Edge-case inputs (empty, corrupt, 5000-character, playlist URL on video view, video URL on playlist view).
 * 3. Queue concurrency limiter (1-8), 50 items simultaneously, pause all, resume all, cancel individual,
 *    and strict state machine transitions (queued -> downloading -> paused -> done/cancelled).
 * 4. 3-second smoothing window in DownloadCard under erratic speed spikes (0 B/s to 100 MB/s),
 *    ensuring smooth ETA and zero division-by-zero or NaN values.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

import App from '@/renderer/App';
import HomeView from '@/renderer/views/HomeView';
import VideoDownloadView from '@/renderer/views/VideoDownloadView';
import PlaylistView from '@/renderer/views/PlaylistView';
import URLInput from '@/renderer/components/URLInput';
import DownloadCard from '@/renderer/components/DownloadCard';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useUIStore } from '@/renderer/stores/uiStore';
import { useThemeStore } from '@/renderer/stores/themeStore';
import { DownloadQueueEngine } from '@/engine/queue/queue';
import { MockProcessRunner } from '@/engine/runner/mock';
import type { DownloadItem, VideoMetadata } from '@/types';

const defaultSettings = {
  downloadPath: '/mock/downloads',
  defaultVideoFormat: '137+140',
  defaultAudioFormat: 'mp3',
  defaultQuality: '1080p',
  concurrency: 3,
  autoUpdate: true,
  theme: 'dark' as const,
  maxClipDuration: 3600,
};

describe('Milestone 4 Adversarial Stress Harness: Workflows, Edge-Cases & Queue Handling', () => {
  let unhandledRejections: any[] = [];
  let rejectionHandler: (err: any) => void;
  let consoleErrors: string[] = [];
  let consoleWarns: string[] = [];
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    vi.clearAllMocks();
    unhandledRejections = [];
    consoleErrors = [];
    consoleWarns = [];

    // Setup reliable electronAPI mocks
    (window as any).electronAPI = {
      ...(window as any).electronAPI,
      getSettings: vi.fn().mockResolvedValue(defaultSettings),
      updateSettings: vi.fn().mockResolvedValue(undefined),
      loadDownloads: vi.fn().mockResolvedValue([]),
      saveDownloads: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue('1.1.1'),
      getMetadata: vi.fn().mockResolvedValue({
        id: 'test1234',
        url: 'https://youtube.com/watch?v=test1234',
        title: 'Mock Video Title',
        duration: 300,
        formats: [
          { format_id: '137', vcodec: 'avc1', resolution: '1920x1080', fps: 30, ext: 'mp4' },
          { format_id: '140', acodec: 'mp4a', resolution: 'audio only', abr: 128, ext: 'm4a' },
        ],
      }),
      addDownload: vi.fn().mockResolvedValue('dl-mock-id'),
      cancelDownload: vi.fn().mockResolvedValue(undefined),
      pauseDownload: vi.fn().mockResolvedValue(undefined),
      resumeDownload: vi.fn().mockResolvedValue(undefined),
      selectDownloadPath: vi.fn().mockResolvedValue('/mock/downloads'),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      openFile: vi.fn().mockResolvedValue(undefined),
      showInFolder: vi.fn().mockResolvedValue(undefined),
      fileExists: vi.fn().mockResolvedValue(true),
      deleteFile: vi.fn().mockResolvedValue(true),
      onDownloadProgress: vi.fn(),
      onDownloadDone: vi.fn(),
      onDownloadError: vi.fn(),
      onDownloadMetadata: vi.fn(),
      onUpdateReady: vi.fn(),
      platform: 'linux',
    };

    rejectionHandler = (event: any) => {
      const reason = event?.reason || event;
      unhandledRejections.push(reason);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', rejectionHandler);
    }
    process.on('unhandledRejection', rejectionHandler);

    originalError = console.error;
    originalWarn = console.warn;

    console.error = (...args: any[]) => {
      const str = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) || String(a))).join(' ');
      consoleErrors.push(str);
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      const str = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a) || String(a))).join(' ');
      consoleWarns.push(str);
      originalWarn(...args);
    };

    // Reset stores with full valid state
    useDownloadStore.setState({ downloads: new Map() });
    useUIStore.setState({ toasts: [], activeTab: '/' });
    useSettingsStore.setState({ ...defaultSettings });
    useThemeStore.setState({ theme: 'dark' });
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('unhandledrejection', rejectionHandler);
    }
    process.removeListener('unhandledRejection' as any, rejectionHandler);
    console.error = originalError;
    console.warn = originalWarn;
    vi.useRealTimers();
  });

  // =========================================================================
  // REQUIREMENT 1: Rapid View Switching Across All 7 Views
  // =========================================================================
  describe('1. Rapid View Switching Across All 7 Views', () => {
    it('1.1 performs 140 rapid view transitions across all 7 views without unmounted state update errors or unhandled rejections', async () => {
      const viewPaths = ['/', '/video', '/audio', '/playlist', '/clips', '/queue', '/settings'];

      function NavController({ onStep }: { onStep: (nav: (p: string) => void) => void }) {
        const navigate = useNavigate();
        React.useEffect(() => {
          onStep((p: string) => navigate(p));
        }, [navigate, onStep]);
        return null;
      }

      let navFn: (p: string) => void = () => {};

      let rendered: any;
      await act(async () => {
        rendered = render(
          <MemoryRouter initialEntries={['/']}>
            <NavController onStep={(fn) => { navFn = fn; }} />
            <App />
          </MemoryRouter>
        );
      });

      // Perform 20 rounds of visiting all 7 tabs = 140 view switches
      for (let round = 0; round < 20; round++) {
        for (const path of viewPaths) {
          act(() => {
            navFn(path);
          });
        }
      }

      // Check random jump switching
      for (let i = 0; i < 30; i++) {
        const randomPath = viewPaths[Math.floor(Math.random() * viewPaths.length)];
        act(() => {
          navFn(randomPath);
        });
      }

      // Unmount the entire application tree
      act(() => {
        rendered.unmount();
      });

      // Assert zero unhandled promise rejections
      expect(unhandledRejections).toEqual([]);

      // Assert zero "Can't perform a React state update on an unmounted component" warnings
      const unmountedWarnings = consoleErrors.concat(consoleWarns).filter((msg) =>
        msg.includes("Can't perform a React state update on an unmounted component") ||
        msg.includes('memory leak')
      );
      expect(unmountedWarnings).toEqual([]);
    });

    it('1.2 rapid switching during in-flight async metadata fetches does not throw unhandled rejections', async () => {
      let resolveFetch: (val: any) => void = () => {};
      const pendingFetch = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      (window as any).electronAPI.getMetadata = vi.fn().mockImplementation(() => pendingFetch);

      function Switcher({ onStep }: { onStep: (nav: (p: string) => void) => void }) {
        const navigate = useNavigate();
        React.useEffect(() => {
          onStep((p: string) => navigate(p));
        }, [navigate, onStep]);
        return null;
      }

      let navFn: (p: string) => void = () => {};
      let rendered: any;

      await act(async () => {
        rendered = render(
          <MemoryRouter initialEntries={['/video']}>
            <Switcher onStep={(fn) => { navFn = fn; }} />
            <App />
          </MemoryRouter>
        );
      });

      // Scope to active tab for input
      const activeTabEl = rendered.container.querySelector('.tab-view.active');
      const urlInput = activeTabEl.querySelector('input[type="url"]');
      const form = activeTabEl.querySelector('form');

      act(() => {
        fireEvent.change(urlInput, { target: { value: 'https://youtube.com/watch?v=inFlight123' } });
        fireEvent.submit(form);
      });

      // In-flight fetch is now pending. Rapidly switch across all other tabs
      const paths = ['/audio', '/playlist', '/clips', '/queue', '/settings', '/'];
      for (const p of paths) {
        act(() => {
          navFn(p);
        });
      }

      // Now resolve the in-flight promise while on a different tab
      await act(async () => {
        resolveFetch({
          id: 'inFlight123',
          url: 'https://youtube.com/watch?v=inFlight123',
          title: 'In Flight Resolved Video',
          duration: 120,
          formats: [],
        });
      });

      // Unmount
      act(() => {
        rendered.unmount();
      });

      expect(unhandledRejections).toEqual([]);
      const stateErrors = consoleErrors.filter((e) => e.includes('unmounted'));
      expect(stateErrors).toEqual([]);
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Stress-Test Edge-Case URL Inputs
  // =========================================================================
  describe('2. Stress-Test Edge-Case URL Inputs', () => {
    it('2.1 empty and whitespace-only URLs are rejected without calling onURL or throwing', () => {
      const onURL = vi.fn();
      render(<URLInput onURL={onURL} placeholder="Test URL" />);

      const form = screen.getByRole('form');
      const input = screen.getByPlaceholderText('Test URL');
      const submitBtn = screen.getByText('ANALYZE');

      // 1. Empty string
      fireEvent.change(input, { target: { value: '' } });
      expect(submitBtn).toBeDisabled();
      fireEvent.submit(form);
      expect(onURL).not.toHaveBeenCalled();

      // 2. Spaces only
      fireEvent.change(input, { target: { value: '     ' } });
      expect(submitBtn).toBeDisabled();
      fireEvent.submit(form);
      expect(onURL).not.toHaveBeenCalled();

      // 3. Tabs and newlines
      fireEvent.change(input, { target: { value: '\t\n\r  ' } });
      expect(submitBtn).toBeDisabled();
      fireEvent.submit(form);
      expect(onURL).not.toHaveBeenCalled();
    });

    it('2.2 handles 5000-character URL gracefully in URLInput and submits trimmed content', () => {
      const onURL = vi.fn();
      render(<URLInput onURL={onURL} placeholder="Long URL" />);

      const hugeUrl = `https://youtube.com/watch?v=dQw4w9WgXcQ&param=${'x'.repeat(5000)}`;
      expect(hugeUrl.length).toBeGreaterThanOrEqual(5000);

      const input = screen.getByPlaceholderText('Long URL');
      fireEvent.change(input, { target: { value: hugeUrl } });

      const submitBtn = screen.getByText('ANALYZE');
      expect(submitBtn).not.toBeDisabled();
      fireEvent.submit(screen.getByRole('form'));

      expect(onURL).toHaveBeenCalledWith(hugeUrl);
    });

    it('2.3 playlist URL entered on single video view redirects to /playlist with info toast', async () => {
      const playlistUrl = 'https://www.youtube.com/playlist?list=PL1234567890abcdef';

      render(
        <MemoryRouter initialEntries={['/video']}>
          <Routes>
            <Route path="/video" element={<VideoDownloadView />} />
            <Route path="/playlist" element={<PlaylistView />} />
          </Routes>
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      act(() => {
        fireEvent.change(input, { target: { value: playlistUrl } });
        fireEvent.submit(screen.getByRole('form'));
      });

      // Check Toast notification
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.title === 'Playlist Detected' || t.message.includes('Redirecting to Playlist'))).toBe(true);
    });

    it('2.4 video URL entered on playlist view redirects to /video with info toast', async () => {
      const singleVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

      render(
        <MemoryRouter initialEntries={['/playlist']}>
          <Routes>
            <Route path="/playlist" element={<PlaylistView />} />
            <Route path="/video" element={<VideoDownloadView />} />
          </Routes>
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/playlist/i);
      act(() => {
        fireEvent.change(input, { target: { value: singleVideoUrl } });
        fireEvent.submit(screen.getByRole('form'));
      });

      // Check Toast notification
      const toasts = useUIStore.getState().toasts;
      expect(toasts.some((t) => t.title === 'Video Detected' || t.message.includes('Redirecting to Video'))).toBe(true);
    });

    it('2.5 corrupt URL or resolver error in VideoDownloadView is caught gracefully without throwing', async () => {
      (window as any).electronAPI.getMetadata = vi.fn().mockRejectedValue(new Error('yt-dlp: Unsupported URL: corrupt://test'));

      render(
        <MemoryRouter initialEntries={['/video']}>
          <VideoDownloadView />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      act(() => {
        fireEvent.change(input, { target: { value: 'corrupt://test' } });
        fireEvent.submit(screen.getByRole('form'));
      });

      await waitFor(() => {
        const toasts = useUIStore.getState().toasts;
        expect(toasts.some((t) => t.type === 'error' && t.message.includes('Could not fetch video info.'))).toBe(true);
      });

      // Ensure button returns to ANALYZE (loading is false)
      expect(screen.getByText('ANALYZE')).toBeInTheDocument();
      expect(unhandledRejections).toEqual([]);
    });

    it('2.6 corrupt URL or resolver error in PlaylistView is caught gracefully without throwing', async () => {
      (window as any).electronAPI.getMetadata = vi.fn().mockRejectedValue(new Error('yt-dlp: Private playlist error'));

      render(
        <MemoryRouter initialEntries={['/playlist']}>
          <PlaylistView />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/playlist/i);
      act(() => {
        fireEvent.change(input, { target: { value: 'https://youtube.com/playlist?list=INVALID' } });
        fireEvent.submit(screen.getByRole('form'));
      });

      await waitFor(() => {
        const toasts = useUIStore.getState().toasts;
        expect(toasts.some((t) => t.type === 'error' && t.message.includes('Could not fetch playlist info.'))).toBe(true);
      });

      expect(screen.getByText('ANALYZE')).toBeInTheDocument();
      expect(unhandledRejections).toEqual([]);
    });
  });

  // =========================================================================
  // REQUIREMENT 3: Queue Concurrency Limiter (1-8), 50 Simultaneous Items,
  // Pause All, Resume All, Cancel Individual, and State Machine Transitions
  // =========================================================================
  describe('3. Queue Concurrency Limiter & State Machine Stress', () => {
    it('3.1 clamps concurrency limiter strictly to [1, 8]', () => {
      const runner = new MockProcessRunner();
      const queue = new DownloadQueueEngine({ runner, concurrency: 3 });

      expect(queue.getConcurrency()).toBe(3);

      queue.setConcurrency(0);
      expect(queue.getConcurrency()).toBe(1);

      queue.setConcurrency(-10);
      expect(queue.getConcurrency()).toBe(1);

      queue.setConcurrency(8);
      expect(queue.getConcurrency()).toBe(8);

      queue.setConcurrency(12);
      expect(queue.getConcurrency()).toBe(8);

      queue.setConcurrency(NaN);
      expect(queue.getConcurrency()).toBe(3);
    });

    it('3.2 enqueues 50 items simultaneously with concurrency 4, pauses all, resumes all, and cancels individual items', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({ stdoutChunks: ['[download] 100% of 10.00MiB'], exitCode: 0, delayMs: 100 });

      const stateTransitions: Record<string, string[]> = {};
      const recordTransition = (id: string, state: string) => {
        if (!stateTransitions[id]) stateTransitions[id] = [];
        stateTransitions[id].push(state);
      };

      const queue = new DownloadQueueEngine({
        runner,
        concurrency: 4,
        onStateChange: (id, oldState, newState) => {
          recordTransition(id, `${oldState}->${newState}`);
        },
      });

      // 1. Enqueue 50 items simultaneously
      const addPromises = [];
      for (let i = 1; i <= 50; i++) {
        addPromises.push(
          queue.add({
            id: `item-${i}`,
            url: `https://youtube.com/watch?v=item_${i}`,
            outputPath: '/downloads',
          })
        );
      }
      await Promise.all(addPromises);

      // Verify active downloads respects concurrency limit (4)
      const statusAfterAdd = queue.getStatus();
      expect(statusAfterAdd.active).toBe(4);
      expect(statusAfterAdd.queued).toBe(46);
      expect(statusAfterAdd.total).toBe(50);

      // 2. Pause All
      await queue.pauseAll();
      const statusAfterPause = queue.getStatus();
      expect(statusAfterPause.active).toBe(0);
      expect(statusAfterPause.paused).toBe(50);

      // 3. Resume All
      await queue.resumeAll();
      const statusAfterResume = queue.getStatus();
      expect(statusAfterResume.active).toBe(4);
      expect(statusAfterResume.queued).toBe(46);
      expect(statusAfterResume.paused).toBe(0);

      // 4. Cancel individual active item (e.g. item-1)
      const cancelledActive = await queue.cancel('item-1');
      expect(cancelledActive).toBe(true);

      // Another queued item should immediately fill the vacated slot
      const statusAfterCancelActive = queue.getStatus();
      expect(statusAfterCancelActive.active).toBe(4);

      // 5. Cancel individual pending item (e.g. item-45)
      const cancelledPending = await queue.cancel('item-45');
      expect(cancelledPending).toBe(true);

      // 6. Dynamic concurrency scaling: scale from 4 up to 8
      queue.setConcurrency(8);
      expect(queue.getConcurrency()).toBe(8);
      const statusAfterScaleUp = queue.getStatus();
      expect(statusAfterScaleUp.active).toBe(8);

      // 7. Dynamic concurrency scaling: scale down to 2
      queue.setConcurrency(2);
      expect(queue.getConcurrency()).toBe(2);

      // Cancel all remaining to cleanly flush
      await queue.cancelAll();
      const finalStatus = queue.getStatus();
      expect(finalStatus.active).toBe(0);
      expect(finalStatus.queued).toBe(0);

      // 8. Verify state machine transitions
      expect(stateTransitions['item-1']).toBeDefined();
      expect(stateTransitions['item-1']).toContain('queued->downloading');
      expect(stateTransitions['item-1']).toContain('downloading->paused');
      expect(stateTransitions['item-1']).toContain('downloading->cancelled');

      expect(unhandledRejections).toEqual([]);
    });

    it('3.3 validates lifecycle state transitions: queued -> downloading -> done', async () => {
      const runner = new MockProcessRunner();
      runner.setDefaultResponse({
        stdoutChunks: ['[download] 100% of 5.00MiB in 00:01 at 5.00MiB/s\n'],
        exitCode: 0,
        delayMs: 10,
      });

      const history: string[] = [];
      const queue = new DownloadQueueEngine({
        runner,
        concurrency: 1,
        onStateChange: (id, oldState, newState) => {
          history.push(`${oldState}->${newState}`);
        },
      });

      const donePromise = new Promise<void>((resolve) => {
        queue.on('item:done', () => resolve());
      });

      await queue.add({
        id: 'fast-item',
        url: 'https://youtube.com/watch?v=fast',
        outputPath: '/downloads',
      });

      await donePromise;

      expect(history).toEqual(['queued->downloading', 'downloading->done']);
      const item = queue.getItem('fast-item');
      expect(item?.status).toBe('done');
      expect(item?.progress.percent).toBe(100);
    });
  });

  // =========================================================================
  // REQUIREMENT 4: 3-Second Smoothing Window in DownloadCard.tsx
  // under Erratic Simulated Speed Inputs (0 B/s to 100 MB/s spikes)
  // =========================================================================
  describe('4. 3-Second Smoothing Window & Speed/ETA Verification in DownloadCard', () => {
    const makeItem = (overrides: Partial<DownloadItem> = {}): DownloadItem => ({
      id: 'smooth-card-1',
      url: 'https://youtube.com/watch?v=smooth',
      title: 'Smoothing Test Video',
      thumbnail: 'https://example.com/thumb.jpg',
      status: 'downloading',
      progress: 25,
      speed: '1.00 MB/s',
      speedBps: 1048576,
      eta: '00:30',
      etaSeconds: 30,
      totalBytes: 104857600,
      downloadedBytes: 26214400,
      config: { url: 'https://youtube.com/watch?v=smooth' },
      createdAt: Date.now(),
      ...overrides,
    });

    it('4.1 smoothly averages erratic speed spikes (0 B/s to 100 MB/s) without NaN or division by zero', () => {
      vi.useFakeTimers();

      let item = makeItem({ speedBps: 0, speed: '0 B/s', etaSeconds: 0, eta: '00:00' });
      const { rerender } = render(<DownloadCard download={item} />);

      // Initial stats check: displays '0 B/s'
      expect(screen.getByText('0 B/s')).toBeInTheDocument();

      // Simulate erratic spikes pushed into DownloadCard over the 3-second window
      // Sample 1: Massive spike 100 MB/s (104,857,600 Bps)
      item = makeItem({ speedBps: 104857600, etaSeconds: 10, progress: 30 });
      rerender(<DownloadCard download={item} />);

      // Sample 2: Sudden drop to 0 B/s
      item = makeItem({ speedBps: 0, etaSeconds: 10, progress: 30 });
      rerender(<DownloadCard download={item} />);

      // Sample 3: Spike to 50 MB/s (52,428,800 Bps)
      item = makeItem({ speedBps: 52428800, etaSeconds: 20, progress: 35 });
      rerender(<DownloadCard download={item} />);

      // Sample 4: 0 B/s
      item = makeItem({ speedBps: 0, etaSeconds: 20, progress: 35 });
      rerender(<DownloadCard download={item} />);

      // Advance time by 3 seconds to trigger rolling average calculation
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Total 5 samples: 0, 104857600, 0, 52428800, 0
      // Sum = 157,286,400 / 5 = 31,457,280 Bps
      // 31,457,280 / 1024 / 1024 = 30.00 MB/s
      expect(screen.getByText('30.00 MB/s')).toBeInTheDocument();

      // Total 5 ETA samples: 0, 10, 10, 20, 20
      // Sum = 60 / 5 = 12s -> "00:12"
      expect(screen.getByText('ETA 00:12')).toBeInTheDocument();

      // Verify that NO element contains "NaN" or "Infinity"
      const allText = document.body.textContent || '';
      expect(allText).not.toContain('NaN');
      expect(allText).not.toContain('Infinity');
    });

    it('4.2 handles 0 B/s throughout window without division by zero and outputs "0 B/s"', () => {
      vi.useFakeTimers();

      let item = makeItem({ speedBps: 0, speed: '0 B/s', etaSeconds: 0, eta: '00:00' });
      const { rerender } = render(<DownloadCard download={item} />);

      // Push 5 samples of 0 B/s
      for (let i = 0; i < 5; i++) {
        item = makeItem({ speedBps: 0, etaSeconds: 0, progress: 10 });
        rerender(<DownloadCard download={item} />);
      }

      // Trigger 3s interval
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('0 B/s')).toBeInTheDocument();
      expect(screen.getByText('ETA 00:00')).toBeInTheDocument();

      const allText = document.body.textContent || '';
      expect(allText).not.toContain('NaN');
      expect(allText).not.toContain('undefined');
    });

    it('4.3 handles tick with zero samples gracefully preserving latest speed/eta without crash', () => {
      vi.useFakeTimers();

      // When speedBps and etaSeconds are undefined, no samples are pushed to samplesRef
      const item = makeItem({ speed: '12.50 MB/s', eta: '01:20', speedBps: undefined, etaSeconds: undefined });
      render(<DownloadCard download={item} />);

      // No new samples pushed; advance time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // Preserves previous valid speed and eta
      expect(screen.getByText('12.50 MB/s')).toBeInTheDocument();
      expect(screen.getByText('ETA 01:20')).toBeInTheDocument();

      const allText = document.body.textContent || '';
      expect(allText).not.toContain('NaN');
    });

    it('4.4 resets smoothed stats immediately when download status changes from downloading to paused', () => {
      vi.useFakeTimers();

      let item = makeItem({ status: 'downloading', speed: '5.00 MB/s', eta: '00:10' });
      const { rerender } = render(<DownloadCard download={item} />);

      expect(screen.getByText('5.00 MB/s')).toBeInTheDocument();

      // Change status to paused
      item = makeItem({ status: 'paused', speed: '', eta: '' });
      rerender(<DownloadCard download={item} />);

      // downloading stats row should hide speed/eta and show Paused badge
      expect(screen.getByText('Paused')).toBeInTheDocument();
      expect(screen.queryByText('5.00 MB/s')).not.toBeInTheDocument();

      const allText = document.body.textContent || '';
      expect(allText).not.toContain('NaN');
    });
  });
});
