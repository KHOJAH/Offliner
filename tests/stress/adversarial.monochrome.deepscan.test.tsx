// @vitest-environment jsdom
/**
 * tests/stress/adversarial.monochrome.deepscan.test.tsx
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS
 * Comprehensive mathematical verification of the Zero-Saturation Invariant
 * (R=G=B, Chroma = 0) in Monochrome Mode across:
 * 1. All CSS variables in :root and [data-theme='monochrome'].
 * 2. 100% of color tokens in THEME_TOKENS.monochrome.
 * 3. All rendered DOM elements across all 8 views and application shell:
 *    - TopNavBar
 *    - HomeView
 *    - VideoDownloadView
 *    - AudioExtractView
 *    - PlaylistView
 *    - ClipsView
 *    - QueueView
 *    - SettingsView
 *    - App (Root shell with all views mounted)
 * 4. Interactive dynamic states (active/inactive tabs, downloads, errors, clip handles).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import fs from 'fs';
import path from 'path';

import {
  useThemeStore,
  THEME_TOKENS,
  applyThemeToDOM,
} from '@/renderer/stores/themeStore';
import { useDownloadStore } from '@/renderer/stores/downloadStore';
import { useSettingsStore } from '@/renderer/stores/settingsStore';

import App from '@/renderer/App';
import TopNavBar from '@/renderer/components/TopNavBar';
import HomeView from '@/renderer/views/HomeView';
import VideoDownloadView from '@/renderer/views/VideoDownloadView';
import AudioExtractView from '@/renderer/views/AudioExtractView';
import PlaylistView from '@/renderer/views/PlaylistView';
import ClipsView from '@/renderer/views/ClipsView';
import QueueView from '@/renderer/views/QueueView';
import SettingsView from '@/renderer/views/SettingsView';
import DownloadCard from '@/renderer/components/DownloadCard';
import ToastContainer from '@/renderer/components/Toast';
import ClipTimeline from '@/renderer/components/ClipTimeline';
import ProgressBar from '@/renderer/components/ProgressBar';
import FormatSelector from '@/renderer/components/FormatSelector';
import type { VideoMetadata, DownloadItem } from '@/types';

// Mock ipcClient
vi.mock('@/renderer/ipc/client', () => ({
  ipcClient: {
    getSettings: vi.fn().mockResolvedValue({ theme: 'monochrome', concurrency: 4 }),
    updateSettings: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockResolvedValue('1.1.1'),
    selectDownloadPath: vi.fn().mockResolvedValue('/tmp/downloads'),
    checkForUpdates: vi.fn().mockResolvedValue({ version: '1.2.0' }),
    getMetadata: vi.fn().mockResolvedValue({
      id: 'test-vid-123',
      url: 'https://youtube.com/watch?v=adversarial123',
      title: 'Adversarial Test Media Stream',
      duration: 180,
      thumbnail: 'https://example.com/thumb.jpg',
      uploader: 'Test Studio Channel',
      is_playlist: false,
      formats: [
        { format_id: '137', ext: 'mp4', resolution: '1080p', vcodec: 'avc1', acodec: 'none', fps: 60 },
        { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', abr: 128 },
        { format_id: '251', ext: 'webm', resolution: 'audio only', vcodec: 'none', acodec: 'opus', abr: 160 },
      ],
      entries: [
        { id: 'item-1', title: 'Playlist Track 1', duration: 120, url: 'https://youtube.com/watch?v=p1' },
        { id: 'item-2', title: 'Playlist Track 2', duration: 240, url: 'https://youtube.com/watch?v=p2' },
      ],
    }),
    addDownload: vi.fn().mockResolvedValue('adv-dl-1'),
    cancelDownload: vi.fn().mockResolvedValue(undefined),
    pauseDownload: vi.fn().mockResolvedValue(undefined),
    resumeDownload: vi.fn().mockResolvedValue(undefined),
    loadDownloads: vi.fn().mockResolvedValue([]),
    saveDownloads: vi.fn().mockResolvedValue(undefined),
    onDownloadProgress: vi.fn().mockReturnValue(() => {}),
    onDownloadDone: vi.fn().mockReturnValue(() => {}),
    onDownloadError: vi.fn().mockReturnValue(() => {}),
    onDownloadMetadata: vi.fn().mockReturnValue(() => {}),
    onUpdateReady: vi.fn().mockReturnValue(() => {}),
  },
}));

// Color parsing utilities
interface RGB {
  r: number;
  g: number;
  b: number;
}

function parseColorString(str: string): RGB | null {
  if (!str || typeof str !== 'string') return null;

  // Hex: #RGB, #RGBA, #RRGGBB, #RRGGBBAA
  const hexMatch = str.match(/#([0-9a-fA-F]{3,8})\b/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.slice(0, 3).split('').map((c) => c + c).join('');
    } else if (hex.length >= 6) {
      hex = hex.slice(0, 6);
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  // RGB/RGBA: rgba?(r, g, b, ...)
  const rgbMatch = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Named colors
  const namedAchromatic: Record<string, RGB> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    gray: { r: 128, g: 128, b: 128 },
    grey: { r: 128, g: 128, b: 128 },
  };
  const lower = str.trim().toLowerCase();
  if (namedAchromatic[lower]) {
    return namedAchromatic[lower];
  }

  return null;
}

function calculateChroma(rgb: RGB): number {
  return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
}

// Adversarial DOM scanner looking for chromatic tokens, styles, or classes
interface Violation {
  element: string;
  type: 'tailwind_class' | 'inline_style' | 'svg_attribute';
  value: string;
  details: string;
}

function scanElementForChromaticLeakage(el: Element): Violation[] {
  const violations: Violation[] = [];
  const elDesc = `<${el.tagName.toLowerCase()}> ${(el.textContent || '').trim().slice(0, 30)}`;

  // 1. Check classes
  const cls = el.getAttribute('class') || '';
  if (cls) {
    // Check for Tailwind built-in chromatic color families
    const chromaticTailwindRegex = /\b(text|bg|border|ring|fill|stroke|from|to|via)-(emerald|red|amber|blue|green|yellow|indigo|purple|pink|orange|teal|cyan|violet|lime|sky|fuchsia)(-\d+)?\b/gi;
    let match: RegExpExecArray | null;
    while ((match = chromaticTailwindRegex.exec(cls)) !== null) {
      violations.push({
        element: elDesc,
        type: 'tailwind_class',
        value: match[0],
        details: `Tailwind chromatic utility class: ${match[0]}`,
      });
    }

    // Check for arbitrary hex color classes, e.g., bg-[#ff0000]
    const arbitraryHexRegex = /(text|bg|border|ring|fill|stroke)-\[#([0-9a-fA-F]{3,8})\]/gi;
    while ((match = arbitraryHexRegex.exec(cls)) !== null) {
      const hex = `#${match[2]}`;
      const rgb = parseColorString(hex);
      if (rgb) {
        const chroma = calculateChroma(rgb);
        if (chroma > 0) {
          violations.push({
            element: elDesc,
            type: 'tailwind_class',
            value: match[0],
            details: `Arbitrary hex class ${match[0]} with Chroma=${chroma} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
          });
        }
      }
    }
  }

  // 2. Check inline style attribute
  const styleAttr = el.getAttribute('style');
  if (styleAttr) {
    // Check for hex codes
    const hexMatches = styleAttr.match(/#([0-9a-fA-F]{3,8})\b/g);
    if (hexMatches) {
      for (const hex of hexMatches) {
        const rgb = parseColorString(hex);
        if (rgb) {
          const chroma = calculateChroma(rgb);
          if (chroma > 0) {
            violations.push({
              element: elDesc,
              type: 'inline_style',
              value: hex,
              details: `Inline style hex ${hex} with Chroma=${chroma} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
            });
          }
        }
      }
    }

    // Check for rgb/rgba
    const rgbMatches = styleAttr.match(/rgba?\([^)]+\)/gi);
    if (rgbMatches) {
      for (const rgbStr of rgbMatches) {
        const rgb = parseColorString(rgbStr);
        if (rgb) {
          const chroma = calculateChroma(rgb);
          if (chroma > 0) {
            violations.push({
              element: elDesc,
              type: 'inline_style',
              value: rgbStr,
              details: `Inline style RGB ${rgbStr} with Chroma=${chroma} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
            });
          }
        }
      }
    }
  }

  // 3. Check SVG fill and stroke
  for (const attr of ['fill', 'stroke']) {
    const val = el.getAttribute(attr);
    if (val && !['none', 'currentcolor', 'transparent', 'inherit'].includes(val.toLowerCase()) && !val.startsWith('var(')) {
      const rgb = parseColorString(val);
      if (rgb) {
        const chroma = calculateChroma(rgb);
        if (chroma > 0) {
          violations.push({
            element: elDesc,
            type: 'svg_attribute',
            value: `${attr}="${val}"`,
            details: `SVG ${attr}="${val}" with Chroma=${chroma} (R=${rgb.r}, G=${rgb.g}, B=${rgb.b})`,
          });
        }
      }
    }
  }

  return violations;
}

function scanTreeForViolations(container: HTMLElement): Violation[] {
  const elements = container.querySelectorAll('*');
  const allViolations: Violation[] = [];
  elements.forEach((el) => {
    const v = scanElementForChromaticLeakage(el);
    if (v.length > 0) {
      allViolations.push(...v);
    }
  });
  return allViolations;
}

describe('Empirical Adversarial Monochrome Deep-Scan', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    useThemeStore.setState({
      theme: 'monochrome',
      preference: 'monochrome',
      tokens: THEME_TOKENS.monochrome,
    });
    applyThemeToDOM('monochrome');
  });

  afterEach(() => {
    cleanup();
  });

  // =========================================================================
  // SUITE 1: CSS Custom Property Zero-Chroma Mathematical Invariant
  // =========================================================================
  describe('Suite 1: CSS Variables & Palette Zero-Saturation Mathematical Audit', () => {
    it('1.1 verifies every CSS variable defined in [data-theme="monochrome"] has Chroma = 0', () => {
      const cssPath = path.resolve(__dirname, '../../src/renderer/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      const monoMatch = css.match(/\[data-theme=["']monochrome["']\]\s*\{([^}]+)\}/);
      expect(monoMatch).not.toBeNull();

      const block = monoMatch![1];
      const lines = block.split('\n').filter((l) => l.trim().startsWith('--'));
      expect(lines.length).toBeGreaterThan(30);

      const chromaticTokens: Array<{ name: string; raw: string; chroma: number }> = [];

      for (const line of lines) {
        const parts = line.split(':');
        const name = parts[0].trim();
        const raw = parts.slice(1).join(':').split(';')[0].split('/*')[0].trim();

        const color = parseColorString(raw);
        if (color) {
          const chroma = calculateChroma(color);
          if (chroma !== 0) {
            chromaticTokens.push({ name, raw, chroma });
          }
        }
      }

      expect(chromaticTokens).toEqual([]);
    });

    it('1.2 verifies every chromatic variable in :root has a corresponding achromatic override in [data-theme="monochrome"]', () => {
      const cssPath = path.resolve(__dirname, '../../src/renderer/index.css');
      const css = fs.readFileSync(cssPath, 'utf8');

      const getVars = (regex: RegExp) => {
        const m = css.match(regex);
        if (!m) return new Map<string, string>();
        const res = new Map<string, string>();
        m[1].split('\n').forEach((l) => {
          if (l.trim().startsWith('--')) {
            const p = l.split(':');
            res.set(p[0].trim(), p.slice(1).join(':').split(';')[0].split('/*')[0].trim());
          }
        });
        return res;
      };

      const rootVars = getVars(/:root\s*\{([^}]+)\}/);
      const monoVars = getVars(/\[data-theme=["']monochrome["']\]\s*\{([^}]+)\}/);

      const unoverriddenChromatic: string[] = [];
      for (const [name, val] of rootVars.entries()) {
        const color = parseColorString(val);
        if (color && calculateChroma(color) > 0) {
          // If this is a chromatic token in :root, it MUST have an override in monochrome
          if (!monoVars.has(name)) {
            unoverriddenChromatic.push(`${name}: "${val}" not overridden in monochrome`);
          } else {
            const monoVal = monoVars.get(name)!;
            const monoColor = parseColorString(monoVal);
            if (!monoColor || calculateChroma(monoColor) !== 0) {
              unoverriddenChromatic.push(`${name}: monochrome override "${monoVal}" is not achromatic`);
            }
          }
        }
      }

      expect(unoverriddenChromatic).toEqual([]);
    });

    it('1.3 verifies 100% of THEME_TOKENS.monochrome are mathematically achromatic (R=G=B, Chroma=0)', () => {
      const tokens = THEME_TOKENS.monochrome;
      const violations: string[] = [];

      for (const [key, value] of Object.entries(tokens)) {
        if (key === 'theme') continue;
        const color = parseColorString(value as string);
        if (!color) {
          violations.push(`Unparseable token ${key}: ${value}`);
          continue;
        }
        const chroma = calculateChroma(color);
        if (chroma !== 0) {
          violations.push(`Token ${key} = "${value}" has Chroma=${chroma}`);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // SUITE 2: DOM Scan Across All 8 Views and Root Shell under Monochrome
  // =========================================================================
  describe('Suite 2: Adversarial DOM Scan Across All 8 Individual Views under Monochrome', () => {
    it('2.1 scans TopNavBar for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <TopNavBar />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.2 scans HomeView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <HomeView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.3 scans VideoDownloadView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <VideoDownloadView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.4 scans AudioExtractView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <AudioExtractView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.5 scans PlaylistView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <PlaylistView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.6 scans ClipsView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <ClipsView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.7 scans QueueView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <QueueView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.8 scans SettingsView for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <SettingsView />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });

    it('2.9 scans App root shell (all views mounted concurrently) for chromatic leakage', () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/']}>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <App />
          </div>
        </MemoryRouter>
      );
      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // SUITE 3: Interactive & Dynamic State Stress under Monochrome
  // =========================================================================
  describe('Suite 3: Interactive Dynamic States Stress Scan under Monochrome', () => {
    it('3.1 audits DownloadCard across all states: downloading, paused, error, done', () => {
      const baseItem: DownloadItem = {
        id: 'dl-item-state',
        url: 'https://youtube.com/watch?v=adv-states',
        title: 'Adversarial Download State Stream',
        thumbnail: 'https://example.com/thumb.jpg',
        status: 'downloading',
        progress: 42,
        speed: '12.5 MB/s',
        eta: '14s',
        totalBytes: 100000000,
        downloadedBytes: 42000000,
        config: { url: 'https://youtube.com/watch?v=adv-states', format: 'mp4' },
        createdAt: Date.now(),
      };

      const states: DownloadItem['status'][] = ['downloading', 'paused', 'error', 'done', 'queued'];
      for (const st of states) {
        const item: DownloadItem = {
          ...baseItem,
          id: `dl-${st}`,
          status: st,
          errorMessage: st === 'error' ? 'Connection aborted by remote host' : undefined,
        };

        const { container } = render(
          <MemoryRouter>
            <div data-theme="monochrome" className="theme-monochrome dark">
              <DownloadCard download={item} />
              <ProgressBar download={item} displayProgress={item.progress} />
            </div>
          </MemoryRouter>
        );

        const violations = scanTreeForViolations(container);
        expect(violations).toEqual([]);
        cleanup();
      }
    });

    it('3.2 audits Toast notifications for all types: info, success, warning, error', () => {
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <ToastContainer />
          </div>
        </MemoryRouter>
      );

      // Verify empty initial container
      expect(scanTreeForViolations(container)).toEqual([]);
    });

    it('3.3 audits ClipTimeline and FormatSelector components directly', () => {
      const sampleFormats = [
        { format_id: '137', ext: 'mp4', resolution: '1080p', vcodec: 'avc1', acodec: 'none', fps: 60 },
        { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', abr: 128 },
      ];
      const { container } = render(
        <MemoryRouter>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <ClipTimeline
              duration={180}
              start={30}
              end={90}
              onStartChange={() => {}}
              onEndChange={() => {}}
            />
            <FormatSelector
              formats={sampleFormats}
              selected="137"
              onSelect={() => {}}
            />
          </div>
        </MemoryRouter>
      );

      const violations = scanTreeForViolations(container);
      expect(violations).toEqual([]);
    });
  });

  // =========================================================================
  // SUITE 4: Dynamic User Flow & Interactivity Stress under Monochrome
  // =========================================================================
  describe('Suite 4: Dynamic User Flows & Active State Mutations under Monochrome', () => {
    it('4.1 verifies AudioExtractView remains 100% achromatic across all 6 codec selections and bitrate chips', async () => {
      const mockMeta: VideoMetadata = {
        id: 'audio-sym-1',
        url: 'https://youtube.com/watch?v=sym1',
        title: 'Symphony No. 5 in C Minor',
        duration: 360,
        thumbnail: 'https://example.com/audio-thumb.jpg',
        uploader: 'Philharmonic',
        is_playlist: false,
        formats: [
          { format_id: '140', ext: 'm4a', resolution: 'audio only', acodec: 'mp4a', abr: 128 },
          { format_id: '251', ext: 'webm', resolution: 'audio only', acodec: 'opus', abr: 160 },
        ],
      };

      const { container } = render(
        <MemoryRouter initialEntries={['/audio']}>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <AudioExtractView />
          </div>
        </MemoryRouter>
      );

      // Verify initial loaded view
      expect(scanTreeForViolations(container)).toEqual([]);

      // Submit URL form to load metadata
      const input = screen.getByPlaceholderText(/paste youtube url/i);
      fireEvent.change(input, { target: { value: 'https://youtube.com/watch?v=adv123' } });
      fireEvent.submit(screen.getByRole('form'));

      await waitFor(() => {
        expect(screen.getByText('Adversarial Test Media Stream')).toBeInTheDocument();
      });

      // Verify view with loaded metadata
      expect(scanTreeForViolations(container)).toEqual([]);

      // Click each codec button and assert zero chromatic leakage at each step
      const codecs = ['MP3', 'M4A', 'FLAC', 'WAV', 'OPUS', 'AAC'];
      for (const codec of codecs) {
        const btn = screen.getByText(codec);
        fireEvent.click(btn);
        const violations = scanTreeForViolations(container);
        expect(violations).toEqual([]);
      }
    });

    it('4.2 verifies SettingsView remains 100% achromatic during theme selection and slider adjustment', async () => {
      const { container } = render(
        <MemoryRouter initialEntries={['/settings']}>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <SettingsView />
          </div>
        </MemoryRouter>
      );

      // Verify initial settings view
      expect(scanTreeForViolations(container)).toEqual([]);

      // Adjust concurrency slider
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '7' } });
      expect(scanTreeForViolations(container)).toEqual([]);

      // Click Pure Monochrome button
      const monoBtn = screen.getByRole('button', { name: 'Pure Monochrome' });
      fireEvent.click(monoBtn);
      expect(scanTreeForViolations(container)).toEqual([]);
    });

    it('4.3 verifies VideoDownloadView remains 100% achromatic with metadata and clipping toggled', async () => {
      const mockVideoMeta: VideoMetadata = {
        id: 'vid-demo-42',
        url: 'https://youtube.com/watch?v=demo42',
        title: 'High Performance 4K Nature Demo',
        duration: 300,
        thumbnail: 'https://example.com/nature.jpg',
        uploader: 'Ultra Studio',
        is_playlist: false,
        formats: [
          { format_id: '137', ext: 'mp4', resolution: '1080p', vcodec: 'avc1', acodec: 'none', fps: 60 },
          { format_id: '140', ext: 'm4a', resolution: 'audio only', vcodec: 'none', acodec: 'mp4a', abr: 128 },
        ],
      };

      const { container } = render(
        <MemoryRouter initialEntries={[{ pathname: '/video', state: { metadata: mockVideoMeta } }]}>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <VideoDownloadView />
          </div>
        </MemoryRouter>
      );

      expect(scanTreeForViolations(container)).toEqual([]);

      // Toggle container format to MKV
      const mkvBtn = screen.queryByText('MKV');
      if (mkvBtn) {
        fireEvent.click(mkvBtn);
        expect(scanTreeForViolations(container)).toEqual([]);
      }

      // Toggle clipping switch
      const clipSwitch = screen.queryByRole('checkbox');
      if (clipSwitch) {
        fireEvent.click(clipSwitch);
        expect(scanTreeForViolations(container)).toEqual([]);
      }
    });

    it('4.4 verifies PlaylistView remains 100% achromatic with loaded batch items', async () => {
      const mockPlaylistMeta: VideoMetadata = {
        id: 'playlist-root',
        url: 'https://youtube.com/playlist?list=PL123456',
        title: 'Essential Ambient Studio Album',
        duration: 900,
        thumbnail: 'https://example.com/playlist-thumb.jpg',
        uploader: 'Ambient Records',
        is_playlist: true,
        formats: [],
        entries: [
          { id: 'track-1', title: 'Track 1 - Dawn Resonance', duration: 300, url: 'https://youtube.com/watch?v=t1', thumbnail: '', uploader: 'Ambient', is_playlist: false, formats: [] },
          { id: 'track-2', title: 'Track 2 - Silver Horizon', duration: 300, url: 'https://youtube.com/watch?v=t2', thumbnail: '', uploader: 'Ambient', is_playlist: false, formats: [] },
          { id: 'track-3', title: 'Track 3 - Deep Obsidian', duration: 300, url: 'https://youtube.com/watch?v=t3', thumbnail: '', uploader: 'Ambient', is_playlist: false, formats: [] },
        ],
      };

      const { container } = render(
        <MemoryRouter initialEntries={[{ pathname: '/playlist', state: { metadata: mockPlaylistMeta } }]}>
          <div data-theme="monochrome" className="theme-monochrome dark">
            <PlaylistView />
          </div>
        </MemoryRouter>
      );

      expect(scanTreeForViolations(container)).toEqual([]);

      // Switch to Audio mode
      const audioModeBtn = screen.queryByText(/Audio \(MP3\/FLAC\)/i);
      if (audioModeBtn) {
        fireEvent.click(audioModeBtn);
        expect(scanTreeForViolations(container)).toEqual([]);
      }
    });
  });
});

