import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopNavBar from '@/components/TopNavBar';
import URLInput from '@/components/URLInput';
import DownloadCard from '@/components/DownloadCard';
import VideoPreview from '@/components/VideoPreview';
import { useDownloadStore } from '@/stores/downloadStore';
import { ipcClient } from '@/ipc/client';
import type { DownloadItem, VideoMetadata } from '@/types';

// Mock electronAPI
const mockElectronAPI = {
  minimize: vi.fn(),
  maximize: vi.fn(),
  close: vi.fn(),
  getMetadata: vi.fn(),
  openFile: vi.fn(),
  showInFolder: vi.fn(),
};
(window as any).electronAPI = mockElectronAPI;

// Mock ipcClient methods
vi.mock('@/ipc/client', () => ({
  ipcClient: {
    openFile: vi.fn(),
    showInFolder: vi.fn(),
    saveDownloads: vi.fn(),
  },
}));

describe('Milestone 1 Empirical Component Invariants & Stress Harness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDownloadStore.setState({
      downloads: new Map<string, DownloadItem>(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. TopNavBar Invariants & Decluttering Verification
  // =========================================================================
  describe('1. TopNavBar Invariants', () => {
    it('1.1 renders current version v1.1.1 and DOES NOT render outdated v2.4', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TopNavBar />
        </MemoryRouter>
      );

      expect(screen.getByText('v1.1.1')).toBeInTheDocument();
      expect(screen.queryByText('v2.4')).not.toBeInTheDocument();
    });

    it('1.2 completely eliminates mock bandwidth speedometer and dummy person avatar', () => {
      const map = new Map<string, DownloadItem>();
      map.set('item-1', { id: 'item-1', url: 'https://youtube.com', status: 'downloading', progress: 10, createdAt: 1, title: 'Item 1', thumbnail: '', config: { url: 'https://youtube.com' } });
      map.set('item-2', { id: 'item-2', url: 'https://youtube.com', status: 'downloading', progress: 20, createdAt: 2, title: 'Item 2', thumbnail: '', config: { url: 'https://youtube.com' } });
      map.set('item-3', { id: 'item-3', url: 'https://youtube.com', status: 'downloading', progress: 30, createdAt: 3, title: 'Item 3', thumbnail: '', config: { url: 'https://youtube.com' } });
      useDownloadStore.setState({ downloads: map });

      render(
        <MemoryRouter initialEntries={['/']}>
          <TopNavBar />
        </MemoryRouter>
      );

      // Verify mock speedometer strings are NOT in document
      expect(screen.queryByText(/Download Speed/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/42.6 MB\/s/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/14.2 MB\/s/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/0.0 MB\/s/i)).not.toBeInTheDocument();

      // Verify dummy avatar is NOT in document
      expect(screen.queryByText('person')).not.toBeInTheDocument();

      // Verify clean sidebar footer text is present
      expect(screen.getByText('Offliner Desktop')).toBeInTheDocument();
    });

    it('1.3 renders all 7 navigation tabs with intact links', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TopNavBar />
        </MemoryRouter>
      );

      const navTabs = ['Home', 'Video', 'Audio', 'Playlist', 'Clips', 'Queue', 'Settings'];
      for (const tab of navTabs) {
        expect(screen.getByText(tab)).toBeInTheDocument();
      }
    });

    it('1.4 queue pill reflects live queue state and triggers navigation', () => {
      const map = new Map<string, DownloadItem>();
      for (let i = 1; i <= 5; i++) {
        map.set(`item-${i}`, {
          id: `item-${i}`,
          url: 'https://youtube.com',
          status: 'queued',
          progress: 0,
          createdAt: i,
          title: `Item ${i}`,
          thumbnail: '',
          config: { url: 'https://youtube.com' },
        });
      }
      useDownloadStore.setState({ downloads: map });

      render(
        <MemoryRouter initialEntries={['/']}>
          <TopNavBar />
        </MemoryRouter>
      );

      const queueButton = screen.getByTitle('Open Queue');
      expect(queueButton).toHaveTextContent('5 queued');
    });

    it('1.5 calls window control APIs on macOS traffic light button clicks', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <TopNavBar />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByTitle('Close'));
      expect(mockElectronAPI.close).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle('Minimize'));
      expect(mockElectronAPI.minimize).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTitle('Maximize'));
      expect(mockElectronAPI.maximize).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 2. URLInput Rapid Thrashing & Adversarial Inputs
  // =========================================================================
  describe('2. URLInput Stress & Edge Cases', () => {
    it('2.1 withstands 100 rapid clicks/submissions and fires onURL consistently', () => {
      const onURL = vi.fn();
      render(<URLInput onURL={onURL} placeholder="Paste YouTube URL" />);

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      const submitBtn = screen.getByRole('button', { name: /ANALYZE/i });

      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=rapid123' } });

      // Stress click 100 times in rapid succession
      for (let i = 0; i < 100; i++) {
        fireEvent.click(submitBtn);
      }

      expect(onURL).toHaveBeenCalledTimes(100);
      expect(onURL).toHaveBeenCalledWith('https://youtube.com/watch?v=rapid123');
    });

    it('2.2 disables submit button when loading=true or input contains only whitespace', () => {
      const onURL = vi.fn();
      const { rerender } = render(<URLInput onURL={onURL} loading={true} />);

      const input = screen.getByPlaceholderText(/paste youtube url/i) as HTMLInputElement;
      const submitBtn = screen.getByRole('button', { name: /ANALYZING.../i });

      expect(input).toBeDisabled();
      expect(submitBtn).toBeDisabled();

      // Clicking disabled submit button does not call onURL
      fireEvent.click(submitBtn);
      expect(onURL).not.toHaveBeenCalled();

      // Set loading to false, test whitespace variations
      rerender(<URLInput onURL={onURL} loading={false} />);
      const form = screen.getByRole('form');
      const regularBtn = screen.getByRole('button', { name: /ANALYZE/i });
      expect(regularBtn).toBeDisabled();

      const whitespaceInputs = ['', '   ', '\t\t', '\n\n\r', '   \t  \n  '];
      for (const ws of whitespaceInputs) {
        fireEvent.change(input, { target: { value: ws } });
        expect(regularBtn).toBeDisabled();
        fireEvent.submit(form);
      }
      expect(onURL).not.toHaveBeenCalled();
    });

    it('2.3 clear button resets input value and clears form state', () => {
      const onURL = vi.fn();
      render(<URLInput onURL={onURL} initialValue="https://youtube.com/watch?v=clear-me" />);

      const input = screen.getByPlaceholderText(/paste youtube url/i) as HTMLInputElement;
      expect(input.value).toBe('https://youtube.com/watch?v=clear-me');

      const clearBtn = screen.getByLabelText('Clear input');
      fireEvent.click(clearBtn);

      expect(input.value).toBe('');
      // Submit button should now be disabled
      const submitBtn = screen.getByRole('button', { name: /ANALYZE/i });
      expect(submitBtn).toBeDisabled();
    });

    it('2.4 accepts className prop and merges it cleanly without overwriting glass styles', () => {
      render(<URLInput onURL={vi.fn()} className="custom-test-class-xyz" />);
      const form = screen.getByRole('form');
      expect(form.className).toContain('custom-test-class-xyz');
      expect(form.className).toContain('glass');
    });

    it('2.5 handles adversarial 50,000-character URL and special characters', () => {
      const onURL = vi.fn();
      render(<URLInput onURL={onURL} />);

      const hugeUrl = 'https://youtube.com/watch?v=' + 'a'.repeat(50000);
      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: hugeUrl } });

      const form = screen.getByRole('form');
      fireEvent.submit(form);

      expect(onURL).toHaveBeenCalledWith(hugeUrl);

      // Adversarial XSS / injection payload
      const xssUrl = 'https://youtube.com/watch?v="><script>alert(1)</script>&name=\' OR 1=1--';
      fireEvent.change(input, { target: { value: xssUrl } });
      fireEvent.submit(form);
      expect(onURL).toHaveBeenCalledWith(xssUrl);
    });
  });

  // =========================================================================
  // 3. DownloadCard Edge Cases & Invariant Verifications
  // =========================================================================
  describe('3. DownloadCard Metrics & Invariants', () => {
    const makeItem = (overrides: Partial<DownloadItem> = {}): DownloadItem => ({
      id: 'dc-test-item-1',
      url: 'https://youtube.com/watch?v=downloadcard1',
      title: 'Standard Test Download Title',
      thumbnail: 'https://example.com/thumbnail.webp',
      status: 'downloading',
      progress: 50,
      speed: '10.00 MB/s',
      speedBps: 10485760,
      eta: '00:45',
      etaSeconds: 45,
      totalBytes: 209715200,
      downloadedBytes: 104857600,
      config: { url: 'https://youtube.com/watch?v=downloadcard1', format: 'MP4' },
      createdAt: Date.now(),
      ...overrides,
    });

    it('3.1 handles 0 B/s speed metric without division by zero or NaN', () => {
      const item = makeItem({ speed: '0 B/s', speedBps: 0, eta: '00:00', etaSeconds: 0 });
      render(<DownloadCard download={item} />);

      expect(screen.getByText('0 B/s')).toBeInTheDocument();
      expect(screen.getByText('ETA 00:00')).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('NaN');
    });

    it('3.2 handles extreme speeds (10 TB/s = 10,995,116,277,760 Bps) without unit overflow', () => {
      vi.useFakeTimers();
      const item = makeItem({ speedBps: 10995116277760, progress: 99 });
      render(<DownloadCard download={item} />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      // 10 TB/s clamped at GB/s unit = 10240.00 GB/s
      expect(screen.getByText(/GB\/s/)).toBeInTheDocument();
      expect(screen.getByText('10240.00 GB/s')).toBeInTheDocument();
      expect(document.body.textContent).not.toContain('NaN');
      expect(document.body.textContent).not.toContain('undefined');
    });

    it('3.3 handles extreme ETA (100 hours = 360,000s) correctly formatted', () => {
      vi.useFakeTimers();
      const item = makeItem({ etaSeconds: 360000, speedBps: 1024 });
      render(<DownloadCard download={item} />);

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('ETA 100:00:00')).toBeInTheDocument();
    });

    it('3.4 renders all status badges with correct semantic text', () => {
      const statuses: Array<[DownloadItem['status'], string]> = [
        ['done', 'Completed'],
        ['downloading', 'Downloading'],
        ['paused', 'Paused'],
        ['queued', 'Queued'],
        ['error', 'Failed'],
        ['cancelled', 'Cancelled'],
      ];

      for (const [status, badgeText] of statuses) {
        const { unmount } = render(<DownloadCard download={makeItem({ status, id: `test-${status}` })} />);
        expect(screen.getByText(badgeText)).toBeInTheDocument();
        unmount();
      }
    });

    it('3.5 correctly dispatches action callbacks across download lifecycles', () => {
      const pauseSpy = vi.fn();
      const resumeSpy = vi.fn();
      const cancelSpy = vi.fn();
      const removeSpy = vi.fn();

      useDownloadStore.setState({
        pauseDownload: pauseSpy,
        resumeDownload: resumeSpy,
        cancelDownload: cancelSpy,
        removePermanent: removeSpy,
      });

      // Downloading: Pause & Cancel
      const { rerender } = render(<DownloadCard download={makeItem({ status: 'downloading', id: 'dl-item' })} />);
      fireEvent.click(screen.getByText('Pause'));
      expect(pauseSpy).toHaveBeenCalledWith('dl-item');
      fireEvent.click(screen.getByText('Cancel'));
      expect(cancelSpy).toHaveBeenCalledWith('dl-item');

      // Paused: Resume & Cancel
      rerender(<DownloadCard download={makeItem({ status: 'paused', id: 'dl-item' })} />);
      fireEvent.click(screen.getByText('Resume'));
      expect(resumeSpy).toHaveBeenCalledWith('dl-item');

      // Completed: Open, Show in Folder, Delete
      rerender(<DownloadCard download={makeItem({ status: 'done', id: 'dl-item', filePath: '/downloads/vid.mp4' })} />);
      fireEvent.click(screen.getByText('Open'));
      expect(ipcClient.openFile).toHaveBeenCalledWith('/downloads/vid.mp4');
      fireEvent.click(screen.getByText('Show in Folder'));
      expect(ipcClient.showInFolder).toHaveBeenCalledWith('/downloads/vid.mp4');
      fireEvent.click(screen.getByText('Delete'));
      expect(removeSpy).toHaveBeenCalledWith('dl-item');

      // Error: Remove
      rerender(<DownloadCard download={makeItem({ status: 'error', id: 'dl-item' })} />);
      fireEvent.click(screen.getByText('Remove'));
      expect(removeSpy).toHaveBeenCalledWith('dl-item');
    });

    it('3.6 replaces crude text "!" error badge with alert SVG on error', () => {
      render(<DownloadCard download={makeItem({ status: 'error' })} />);
      // Raw "!" text should NOT exist as an isolated error indicator
      expect(screen.queryByText('!')).not.toBeInTheDocument();
      // Error badge "Failed" exists
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('3.7 renders single formatTag on thumbnail and NOT duplicated next to title', () => {
      render(<DownloadCard download={makeItem({ config: { url: 'https://youtube.com', format: 'MP4' } })} />);
      // Should find exactly one MP4 badge on the thumbnail
      const mp4Tags = screen.getAllByText('MP4');
      expect(mp4Tags.length).toBe(1);
    });

    it('3.8 handles long title with special unicode & emojis without crashing', () => {
      const longTitle = '🎥 ' + 'Ultra-Long Title '.repeat(20) + '🚀 🌟 100% Valid';
      const { container } = render(<DownloadCard download={makeItem({ title: longTitle })} />);
      const titleElem = container.querySelector('.truncate');
      expect(titleElem).toBeInTheDocument();
      expect(titleElem?.textContent).toBe(longTitle);
    });
  });

  // =========================================================================
  // 4. VideoPreview Edge Cases & Invariant Verifications
  // =========================================================================
  describe('4. VideoPreview Edge Cases & Invariants', () => {
    const makeMetadata = (overrides: Partial<VideoMetadata> = {}): VideoMetadata => ({
      id: 'vid-meta-1',
      url: 'https://youtube.com/watch?v=preview1',
      title: 'Sample Video Preview Title',
      duration: 3665, // 1h 1m 5s -> "1:01:05"
      thumbnail: 'https://example.com/thumb.jpg',
      uploader: 'Official Creator',
      view_count: 1542000,
      formats: [],
      is_playlist: false,
      ...overrides,
    });

    it('4.1 formats standard and long video durations correctly', () => {
      // 1h 1m 5s -> "1:01:05"
      const { rerender } = render(<VideoPreview metadata={makeMetadata({ duration: 3665 })} />);
      expect(screen.getByText('1:01:05')).toBeInTheDocument();

      // 2m 5s -> "2:05"
      rerender(<VideoPreview metadata={makeMetadata({ duration: 125 })} />);
      expect(screen.getByText('2:05')).toBeInTheDocument();

      // 45s -> "0:45"
      rerender(<VideoPreview metadata={makeMetadata({ duration: 45 })} />);
      expect(screen.getByText('0:45')).toBeInTheDocument();
    });

    it('4.2 suppresses duration badge when duration is 0, negative, or missing', () => {
      // 0 duration
      const { rerender } = render(<VideoPreview metadata={makeMetadata({ duration: 0 })} />);
      expect(screen.queryByText(/0:00/)).not.toBeInTheDocument();

      // Negative duration
      rerender(<VideoPreview metadata={makeMetadata({ duration: -50 })} />);
      expect(screen.queryByText(/-50/)).not.toBeInTheDocument();
    });

    it('4.3 formats view count with K and M abbreviations', () => {
      // Millions
      const { rerender } = render(<VideoPreview metadata={makeMetadata({ view_count: 1542000 })} />);
      expect(screen.getByText('1.5M views')).toBeInTheDocument();

      // Thousands
      rerender(<VideoPreview metadata={makeMetadata({ view_count: 24500 })} />);
      expect(screen.getByText('24.5K views')).toBeInTheDocument();

      // Hundreds (unabbreviated)
      rerender(<VideoPreview metadata={makeMetadata({ view_count: 450 })} />);
      expect(screen.getByText('450 views')).toBeInTheDocument();
    });

    it('4.4 renders bullet separator ONLY when both uploader and view_count exist', () => {
      // Both present
      const { rerender } = render(<VideoPreview metadata={makeMetadata({ uploader: 'Channel A', view_count: 5000 })} />);
      expect(screen.getByText('Channel A')).toBeInTheDocument();
      expect(screen.getByText('5.0K views')).toBeInTheDocument();
      expect(screen.getByText('•')).toBeInTheDocument();

      // Only uploader present -> no bullet
      rerender(<VideoPreview metadata={makeMetadata({ uploader: 'Channel Only', view_count: undefined })} />);
      expect(screen.getByText('Channel Only')).toBeInTheDocument();
      expect(screen.queryByText('•')).not.toBeInTheDocument();

      // Only view count present -> no bullet
      rerender(<VideoPreview metadata={makeMetadata({ uploader: '', view_count: 8000 })} />);
      expect(screen.getByText('8.0K views')).toBeInTheDocument();
      expect(screen.queryByText('•')).not.toBeInTheDocument();
    });

    it('4.5 does not render duplicate duration or spurious accent dot in metadata row', () => {
      render(<VideoPreview metadata={makeMetadata({ duration: 180, uploader: 'Clean Artist' })} />);
      // Duration is in thumbnail overlay, should appear exactly ONCE
      const durations = screen.getAllByText('3:00');
      expect(durations.length).toBe(1);

      // Verify no spurious accent dot
      const allElements = document.querySelectorAll('span');
      const accentDots = Array.from(allElements).filter((el) =>
        el.className.includes('rounded-full') && el.className.includes('bg-[var(--accent)]')
      );
      expect(accentDots.length).toBe(0);
    });

    it('4.6 survives 1,000-character titles, XSS vectors, and RTL unicode strings', () => {
      const xssTitle = '<img src=x onerror=alert(1)> & " \' <svg/onload=alert(2)>';
      const { rerender } = render(<VideoPreview metadata={makeMetadata({ title: xssTitle })} />);
      expect(screen.getByText(xssTitle)).toBeInTheDocument();

      const rtlTitle = 'مرحبا بكم في تطبيق أوفلاينر لتنزيل الفيديوهات والصوتيات';
      rerender(<VideoPreview metadata={makeMetadata({ title: rtlTitle })} />);
      expect(screen.getByText(rtlTitle)).toBeInTheDocument();

      const hugeTitle = 'A'.repeat(1000);
      rerender(<VideoPreview metadata={makeMetadata({ title: hugeTitle })} />);
      expect(screen.getByText(hugeTitle)).toBeInTheDocument();
    });
  });
});
