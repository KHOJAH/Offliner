// tests/components/SettingsView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SettingsView from '@/renderer/views/SettingsView';
import { useSettingsStore } from '@/renderer/stores/settingsStore';
import { useThemeStore } from '@/renderer/stores/themeStore';

describe('SettingsView - Preferences & Architecture Swatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).electronAPI.getVersion.mockResolvedValue('1.1.1');
    (window as any).electronAPI.selectDownloadPath.mockResolvedValue('/custom/download/path');
    (window as any).electronAPI.checkForUpdates.mockResolvedValue(null);
  });

  it('renders settings groups, version info, and download location', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('General & Storage')).toBeInTheDocument();
    expect(screen.getByText('Appearance & Themes')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Current Version: 1.1.1/i)).toBeInTheDocument();
    });
  });

  it('selects new download directory when clicking Browse', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );

    const browseBtn = screen.getByText('Browse');
    fireEvent.click(browseBtn);

    await waitFor(() => {
      expect((window as any).electronAPI.selectDownloadPath).toHaveBeenCalled();
    });

    expect(useSettingsStore.getState().downloadPath).toBe('/custom/download/path');
  });

  it('updates theme when clicking theme swatch or button', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );

    // Click Pure Monochrome swatch
    const monoSwatch = screen.getByText('Pure Monochrome');
    fireEvent.click(monoSwatch);

    await waitFor(() => {
      expect(useThemeStore.getState().theme).toBe('monochrome');
      expect(useSettingsStore.getState().theme).toBe('monochrome');
    });

    // Click Light button
    const lightBtn = screen.getByRole('button', { name: 'Light' });
    fireEvent.click(lightBtn);

    await waitFor(() => {
      expect(useThemeStore.getState().theme).toBe('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });
  });

  it('updates concurrency slider bounded 1 to 8', async () => {
    render(
      <MemoryRouter>
        <SettingsView />
      </MemoryRouter>
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '6' } });

    await waitFor(() => {
      expect(useSettingsStore.getState().concurrency).toBe(6);
    });
  });
});
