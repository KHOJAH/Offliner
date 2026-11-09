// tests/components/QueueView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QueueView from '@/renderer/views/QueueView';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import type { DownloadItem } from '@/types';

const createMockItem = (id: string, status: DownloadItem['status'], title: string): DownloadItem => ({
  id,
  url: `https://youtube.com/watch?v=${id}`,
  title,
  thumbnail: 'https://example.com/thumb.jpg',
  status,
  progress: status === 'done' ? 100 : 45,
  speed: '2.5 MB/s',
  speedBps: 2500000,
  eta: '00:15',
  etaSeconds: 15,
  totalBytes: 50000000,
  downloadedBytes: status === 'done' ? 50000000 : 22500000,
  config: { url: `https://youtube.com/watch?v=${id}` },
  createdAt: Date.now(),
});

describe('QueueView - Transfers Download Queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDownloadStore.setState({ downloads: new Map() });
  });

  it('renders "No Downloads" placeholder when queue is empty', () => {
    render(<QueueView />);

    expect(screen.getByText('No Downloads')).toBeInTheDocument();
    expect(screen.getByText('Items you download will appear here.')).toBeInTheDocument();
  });

  it('categorizes downloads into 5 sections: Active, Queued, Completed, Deleted, Failed', () => {
    const mockMap = new Map<string, DownloadItem>([
      ['dl-1', createMockItem('dl-1', 'downloading', 'Active Video 1')],
      ['dl-2', createMockItem('dl-2', 'queued', 'Queued Video 2')],
      ['dl-3', createMockItem('dl-3', 'done', 'Done Video 3')],
      ['dl-4', createMockItem('dl-4', 'cancelled', 'Cancelled Video 4')],
      ['dl-5', createMockItem('dl-5', 'error', 'Error Video 5')],
    ]);
    useDownloadStore.setState({ downloads: mockMap });

    render(<QueueView />);

    expect(screen.getByRole('heading', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Queued' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deleted' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Failed' })).toBeInTheDocument();

    expect(screen.getByText('Active Video 1')).toBeInTheDocument();
    expect(screen.getByText('Queued Video 2')).toBeInTheDocument();
    expect(screen.getByText('Done Video 3')).toBeInTheDocument();
  });

  it('clicking "Clear Finished" triggers clearFinishedDownloads', () => {
    const mockMap = new Map<string, DownloadItem>([
      ['dl-1', createMockItem('dl-1', 'done', 'Done Video 1')],
      ['dl-2', createMockItem('dl-2', 'downloading', 'Active Video 2')],
    ]);
    useDownloadStore.setState({ downloads: mockMap });

    render(<QueueView />);

    const clearBtn = screen.getByText('Clear Finished');
    fireEvent.click(clearBtn);

    // After clear, only active remains
    const current = useDownloadStore.getState().downloads;
    expect(current.has('dl-1')).toBe(false);
    expect(current.has('dl-2')).toBe(true);
  });
});
