// tests/components/ClipsQuality.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VideoDownloadView from '@/renderer/views/VideoDownloadView';
import ClipsView from '@/renderer/views/ClipsView';
import type { VideoMetadata } from '@/types';

const mockMetadata: VideoMetadata = {
  id: 'test-vid',
  url: 'https://youtube.com/watch?v=test123',
  title: 'Test Quality Video',
  duration: 120,
  thumbnail: 'https://example.com/thumb.jpg',
  uploader: 'Test Creator',
  is_playlist: false,
  formats: [
    { format_id: '18', ext: 'mp4', resolution: '640x360', vcodec: 'avc1', acodec: 'mp4a', fps: 30 },
    { format_id: '136', ext: 'mp4', resolution: '1280x720', vcodec: 'avc1', acodec: 'none', fps: 30 },
    { format_id: '137', ext: 'mp4', resolution: '1920x1080', vcodec: 'avc1', acodec: 'none', fps: 60 },
  ],
};

describe('Clip Quality Preservation in Views', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI.getMetadata.mockResolvedValue(mockMetadata);
    (window as any).electronAPI.addDownload.mockResolvedValue('download-uuid-1');
  });

  describe('VideoDownloadView', () => {
    it('downloads clip with the chosen format instead of discarding it', async () => {
      render(
        <MemoryRouter initialEntries={['/video']}>
          <VideoDownloadView />
        </MemoryRouter>
      );

      // Submit URL
      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test123' } });
      fireEvent.submit(screen.getByRole('form'));

      // Wait for metadata to load
      await waitFor(() => {
        expect(screen.getByText('Test Quality Video')).toBeInTheDocument();
      });

      // Default should select best format (1080p, format_id '137')
      // Let's explicitly select 720p (format_id '136')
      const btn720p = screen.getByText('1280x720');
      fireEvent.click(btn720p);

      // Enable clipping toggle: initially shows "Download Clip", once expanded shows "Hide Clip Picker"
      const clipToggleBtn = screen.getByRole('button', { name: 'Download Clip' });
      fireEvent.click(clipToggleBtn);

      // Now toggle shows "Hide Clip Picker" and bottom submit button shows "Download Clip"
      expect(screen.getByRole('button', { name: 'Hide Clip Picker' })).toBeInTheDocument();
      const downloadBtn = screen.getByRole('button', { name: 'Download Clip' });
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
      });

      const calledConfig = (window as any).electronAPI.addDownload.mock.calls[0][0];
      expect(calledConfig.url).toBe('https://youtube.com/watch?v=test123');
      expect(calledConfig.format).toBe('136');
      expect(calledConfig.clips).toBeDefined();
      expect(calledConfig.clips).toHaveLength(1);
    });

    it('downloads clip with best format by default when user does not change format', async () => {
      render(
        <MemoryRouter initialEntries={['/video']}>
          <VideoDownloadView />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test123' } });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText('Test Quality Video')).toBeInTheDocument();
      });

      // Enable clipping without changing format (should remain 1080p / '137')
      const clipToggleBtn = screen.getByRole('button', { name: 'Download Clip' });
      fireEvent.click(clipToggleBtn);

      const downloadBtn = screen.getByRole('button', { name: 'Download Clip' });
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
      });

      const calledConfig = (window as any).electronAPI.addDownload.mock.calls[0][0];
      expect(calledConfig.format).toBe('137');
      expect(calledConfig.clips).toBeDefined();
    });
  });

  describe('ClipsView', () => {
    it('allows quality selection and downloads all clips with chosen quality', async () => {
      render(
        <MemoryRouter initialEntries={['/clips']}>
          <ClipsView />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test123' } });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText('Test Quality Video')).toBeInTheDocument();
      });

      // Format & Quality section should be rendered
      expect(screen.getByText('Format & Quality')).toBeInTheDocument();
      expect(screen.getByText('1920x1080')).toBeInTheDocument();
      expect(screen.getByText('1280x720')).toBeInTheDocument();

      // Add a clip
      const addClipBtn = screen.getByText('Add Clip');
      fireEvent.click(addClipBtn);

      // Select 720p ('136')
      const btn720p = screen.getByText('1280x720');
      fireEvent.click(btn720p);

      // Download all clips
      const downloadAllBtn = screen.getByText('Download All Clips');
      fireEvent.click(downloadAllBtn);

      await waitFor(() => {
        expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
      });

      const calledConfig = (window as any).electronAPI.addDownload.mock.calls[0][0];
      expect(calledConfig.format).toBe('136');
      expect(calledConfig.clips).toHaveLength(1);
    });

    it('defaults to highest/best video quality when no quality is manually clicked in ClipsView', async () => {
      render(
        <MemoryRouter initialEntries={['/clips']}>
          <ClipsView />
        </MemoryRouter>
      );

      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=test123' } });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText('Test Quality Video')).toBeInTheDocument();
      });

      // Add clip and download immediately without changing format
      const addClipBtn = screen.getByText('Add Clip');
      fireEvent.click(addClipBtn);

      const downloadAllBtn = screen.getByText('Download All Clips');
      fireEvent.click(downloadAllBtn);

      await waitFor(() => {
        expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
      });

      const calledConfig = (window as any).electronAPI.addDownload.mock.calls[0][0];
      expect(calledConfig.format).toBe('137');
    });
  });
});
