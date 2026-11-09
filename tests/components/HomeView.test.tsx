// tests/components/HomeView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeView from '@/renderer/views/HomeView';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('HomeView - Universal Resolver & Quick Action Dispatch', () => {
  it('renders brand header, engine badge, omnibox, and 3 quick action cards', () => {
    render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    );

    expect(screen.getByText('OFFLINER')).toBeInTheDocument();
    expect(screen.getByText(/Native Engine Active/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste video or playlist/i)).toBeInTheDocument();
    expect(screen.getByText('Video')).toBeInTheDocument();
    expect(screen.getByText('Audio')).toBeInTheDocument();
    expect(screen.getByText('Clips')).toBeInTheDocument();
  });

  it('routes single video URLs to /video', () => {
    render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/paste video or playlist/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=dQw4w9WgXcQ' } });
    fireEvent.submit(screen.getByRole('form'));

    expect(mockNavigate).toHaveBeenCalledWith('/video', {
      state: { url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', autoAnalyze: true },
    });
  });

  it('routes playlist URLs to /playlist', () => {
    render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/paste video or playlist/i);
    fireEvent.change(input, { target: { value: 'https://youtube.com/playlist?list=PL12345' } });
    fireEvent.submit(screen.getByRole('form'));

    expect(mockNavigate).toHaveBeenCalledWith('/playlist', {
      state: { url: 'https://youtube.com/playlist?list=PL12345', autoAnalyze: true },
    });
  });

  it('navigates when clicking quick action cards', () => {
    render(
      <MemoryRouter>
        <HomeView />
      </MemoryRouter>
    );

    const videoCard = screen.getByText('Video');
    fireEvent.click(videoCard);
    expect(mockNavigate).toHaveBeenCalledWith('/video');

    const audioCard = screen.getByText('Audio');
    fireEvent.click(audioCard);
    expect(mockNavigate).toHaveBeenCalledWith('/audio');

    const clipsCard = screen.getByText('Clips');
    fireEvent.click(clipsCard);
    expect(mockNavigate).toHaveBeenCalledWith('/clips');
  });
});
