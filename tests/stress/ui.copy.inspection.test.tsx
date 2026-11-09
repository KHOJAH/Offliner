// tests/stress/ui.copy.inspection.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeView from '@/renderer/views/HomeView';
import VideoDownloadView from '@/renderer/views/VideoDownloadView';
import AudioExtractView from '@/renderer/views/AudioExtractView';
import PlaylistView from '@/renderer/views/PlaylistView';
import ClipsView from '@/renderer/views/ClipsView';
import QueueView from '@/renderer/views/QueueView';
import SettingsView from '@/renderer/views/SettingsView';
import TopNavBar from '@/renderer/components/TopNavBar';
import DownloadCard from '@/renderer/components/DownloadCard';
import VideoPreview from '@/renderer/components/VideoPreview';
import FormatSelector from '@/renderer/components/FormatSelector';
import type { VideoMetadata, DownloadItem } from '@/types';

const BANNED_TECHNO_BABBLE = [
  'Pipeline Daemon',
  'SSL Cert Verified',
  'FFmpeg 7.1 Hardlinked',
  'Universal Desktop Binary',
  'DSP Core',
  'Zero-Reencode',
  'Module 03',
  'Module 05',
  'Timeline Cutter',
  'Lossless Non-Destructive Split',
  'Session #4829-QX',
  'Engine Stream // Local Socket',
  'Active Pipes',
  'Batch Pipeline Synced',
  'Estimated ~4.2 GB Source Total',
  'Available & Ready',
  'Bandwidth Cache',
  'System Environment & Execution Matrix',
  'TCP socket',
  'bandwidth starvation',
  '4K 60fps VP9',
  '320kbps Opus',
  'ProRes',
  'Playhead:',
  'Raw Bitstream',
  'Multi-Target DSP',
  'DASH Stream',
  'YouTube Engine',
];

const mockMetadata: VideoMetadata = {
  id: 'test-vid-1',
  url: 'https://youtube.com/watch?v=test123',
  title: 'Sample Video for Testing',
  duration: 300,
  thumbnail: 'https://example.com/thumb.jpg',
  uploader: 'Test Channel',
  is_playlist: false,
  formats: [
    { format_id: '137', ext: 'mp4', resolution: '1920x1080', vcodec: 'avc1', acodec: 'none', fps: 30, vbr: 2500 },
    { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a.40.2', abr: 128 },
  ],
};

const mockDownloadItem: DownloadItem = {
  id: 'dl-item-1',
  url: 'https://youtube.com/watch?v=test123',
  title: 'Sample Download Item',
  thumbnail: 'https://example.com/thumb.jpg',
  status: 'downloading',
  progress: 55,
  speed: '4.2 MB/s',
  speedBps: 4200000,
  eta: '01:20',
  etaSeconds: 80,
  totalBytes: 100000000,
  downloadedBytes: 55000000,
  config: { url: 'https://youtube.com/watch?v=test123' },
  createdAt: Date.now(),
};

function assertNoTechnoBabble(container: HTMLElement, viewName: string) {
  const textContent = container.textContent || '';
  for (const banned of BANNED_TECHNO_BABBLE) {
    expect(
      textContent.includes(banned),
      `Found banned techno-babble phrase "${banned}" in ${viewName}`
    ).toBe(false);
  }
}

describe('Consumer UI Copy & Jargon Elimination Inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI.getVersion.mockResolvedValue('1.1.1');
    (window as any).electronAPI.selectDownloadPath.mockResolvedValue('/downloads');
    (window as any).electronAPI.checkForUpdates.mockResolvedValue(null);
  });

  it('audits HomeView for zero developer jargon', () => {
    const { container } = render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'HomeView');
  });

  it('audits TopNavBar for zero developer jargon', () => {
    const { container } = render(
      <MemoryRouter>
        <TopNavBar />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'TopNavBar');
  });

  it('audits SettingsView for zero developer jargon', () => {
    const { container } = render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'SettingsView');
  });

  it('audits QueueView for zero developer jargon', () => {
    const { container } = render(
      <MemoryRouter>
        <QueueView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'QueueView');
  });

  it('audits VideoDownloadView for zero developer jargon (empty and loaded)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/video']}>
        <VideoDownloadView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'VideoDownloadView (empty)');
  });

  it('audits AudioExtractView for zero developer jargon (empty and loaded)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/audio']}>
        <AudioExtractView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'AudioExtractView (empty)');
  });

  it('audits PlaylistView for zero developer jargon (empty and loaded)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/playlist']}>
        <PlaylistView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'PlaylistView (empty)');
  });

  it('audits ClipsView for zero developer jargon (empty and loaded)', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/clips']}>
        <ClipsView />
      </MemoryRouter>
    );
    assertNoTechnoBabble(container, 'ClipsView (empty)');
  });

  it('audits DownloadCard, VideoPreview, and FormatSelector for zero developer jargon', () => {
    const { container: cardContainer } = render(
      <MemoryRouter>
        <DownloadCard download={mockDownloadItem} />
      </MemoryRouter>
    );
    assertNoTechnoBabble(cardContainer, 'DownloadCard');

    const { container: previewContainer } = render(
      <MemoryRouter>
        <VideoPreview metadata={mockMetadata} />
      </MemoryRouter>
    );
    assertNoTechnoBabble(previewContainer, 'VideoPreview');

    const { container: formatContainer } = render(
      <MemoryRouter>
        <FormatSelector
          formats={mockMetadata.formats}
          selected="137"
          onSelect={() => {}}
        />
      </MemoryRouter>
    );
    assertNoTechnoBabble(formatContainer, 'FormatSelector');
  });
});
