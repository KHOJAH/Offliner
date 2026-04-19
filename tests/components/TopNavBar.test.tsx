// tests/components/TopNavBar.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TopNavBar from '@/renderer/components/TopNavBar';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock electronAPI
const mockMinimize = vi.fn();
const mockMaximize = vi.fn();
const mockClose = vi.fn();

(window as any).electronAPI = {
  minimize: mockMinimize,
  maximize: mockMaximize,
  close: mockClose,
};

describe('TopNavBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all navigation tabs', () => {
    render(
      <MemoryRouter>
        <TopNavBar />
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Video')).toBeDefined();
    expect(screen.getByText('Audio')).toBeDefined();
    expect(screen.getByText('Playlist')).toBeDefined();
    expect(screen.getByText('Clips')).toBeDefined();
    expect(screen.getByText('Queue')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
  });

  it('calls minimize when minimize button is clicked', () => {
    render(
      <MemoryRouter>
        <TopNavBar />
      </MemoryRouter>
    );

    // The WindowControl components don't have text, but they have titles
    const minBtn = screen.getByTitle('Minimize');
    fireEvent.click(minBtn);
    expect(mockMinimize).toHaveBeenCalled();
  });

  it('calls maximize when maximize button is clicked', () => {
    render(
      <MemoryRouter>
        <TopNavBar />
      </MemoryRouter>
    );

    const maxBtn = screen.getByTitle('Maximize');
    fireEvent.click(maxBtn);
    expect(mockMaximize).toHaveBeenCalled();
  });

  it('calls close when close button is clicked', () => {
    render(
      <MemoryRouter>
        <TopNavBar />
      </MemoryRouter>
    );

    const closeBtn = screen.getByTitle('Close');
    fireEvent.click(closeBtn);
    expect(mockClose).toHaveBeenCalled();
  });
});
