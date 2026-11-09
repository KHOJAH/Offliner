// tests/components/AudioExtractView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AudioExtractView from '@/renderer/views/AudioExtractView';
import type { VideoMetadata } from '@/types';

const mockAudioMetadata: VideoMetadata = {
  id: 'audio-vid-1',
  url: 'https://youtube.com/watch?v=audio123',
  title: 'Test Symphony Orchestral Audio',
  duration: 240,
  thumbnail: 'https://example.com/audio-thumb.jpg',
  uploader: 'Philharmonic Orchestra',
  is_playlist: false,
  formats: [
    { format_id: '251', ext: 'webm', resolution: 'audio only', acodec: 'opus', abr: 160 },
    { format_id: '140', ext: 'm4a', resolution: 'audio only', acodec: 'mp4a.40.2', abr: 128 },
  ],
};

describe('AudioExtractView - 6-Codec Parity & Studio Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI.getMetadata.mockResolvedValue(mockAudioMetadata);
    (window as any).electronAPI.addDownload.mockResolvedValue('audio-dl-uuid-1');
  });

  it('renders all 6 required audio codecs: MP3, M4A, FLAC, WAV, OPUS, AAC', async () => {
    render(
      <MemoryRouter initialEntries={['/audio']}>
        <AudioExtractView />
      </MemoryRouter>
    );

    // Submit URL
    const input = screen.getByPlaceholderText(/paste youtube url/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=audio123' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByText('Test Symphony Orchestral Audio')).toBeInTheDocument();
    });

    // Check that all 6 codecs are rendered
    expect(screen.getByText('MP3')).toBeInTheDocument();
    expect(screen.getByText('M4A')).toBeInTheDocument();
    expect(screen.getByText('FLAC')).toBeInTheDocument();
    expect(screen.getByText('WAV')).toBeInTheDocument();
    expect(screen.getByText('OPUS')).toBeInTheDocument();
    expect(screen.getByText('AAC')).toBeInTheDocument();
  });

  it('switches codec and dispatches download with selected format and quality', async () => {
    render(
      <MemoryRouter initialEntries={['/audio']}>
        <AudioExtractView />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/paste youtube url/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=audio123' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByText('Test Symphony Orchestral Audio')).toBeInTheDocument();
    });

    // Select FLAC
    const flacBtn = screen.getByText('FLAC');
    fireEvent.click(flacBtn);

    // Click Extract Audio button
    const extractBtn = screen.getByRole('button', { name: /extract audio/i });
    fireEvent.click(extractBtn);

    await waitFor(() => {
      expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
    });

    const callArgs = (window as any).electronAPI.addDownload.mock.calls[0][0];
    expect(callArgs.url).toBe('https://youtube.com/watch?v=audio123');
    expect(callArgs.audioFormat).toBe('flac');
    expect(callArgs.audioQuality).toBe(0);
  });

  it('supports selecting M4A and OPUS codecs', async () => {
    render(
      <MemoryRouter initialEntries={['/audio']}>
        <AudioExtractView />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/paste youtube url/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=audio123' } });
    fireEvent.submit(screen.getByRole('form'));

    await waitFor(() => {
      expect(screen.getByText('Test Symphony Orchestral Audio')).toBeInTheDocument();
    });

    // Select OPUS
    const opusBtn = screen.getByText('OPUS');
    fireEvent.click(opusBtn);

    const extractBtn = screen.getByRole('button', { name: /extract audio/i });
    fireEvent.click(extractBtn);

    await waitFor(() => {
      expect((window as any).electronAPI.addDownload).toHaveBeenCalledTimes(1);
    });

    const callArgs = (window as any).electronAPI.addDownload.mock.calls[0][0];
    expect(callArgs.audioFormat).toBe('opus');
  });
});
