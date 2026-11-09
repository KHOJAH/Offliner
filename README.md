# Offliner

<p align="center">
  <img src="Pics/logo.png" alt="Offliner Logo" width="180" />
</p>

<p align="center">
  <strong>The minimal, high-performance desktop media downloader inspired by Apple and Claude design aesthetics.</strong><br />
  Built with Electron, React, TypeScript, and Tailwind CSS. Powered by <code>yt-dlp</code> and <code>ffmpeg</code>.
</p>

<p align="center">
  <a href="https://github.com/KHOJAH/Offliner/releases/latest"><img src="https://img.shields.io/github/v/release/KHOJAH/Offliner?style=flat-square&color=2997FF&label=Release" alt="Latest Release" /></a>
  <a href="https://github.com/KHOJAH/Offliner"><img src="https://img.shields.io/badge/Tests-541%20Passing%20(Tiers%201--5)-30D158?style=flat-square" alt="Vitest Tests Passing" /></a>
  <a href="https://github.com/KHOJAH/Offliner/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="MIT License" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-%3E%3D%2018.0.0-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://stitch.withgoogle.com"><img src="https://img.shields.io/badge/UI%20Design-Google%20Stitch-purple?style=flat-square" alt="Google Stitch" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Cross-Platform" />
</p>

---

## Table of Contents

- [Downloads & Pre-built Installers](#-downloads--pre-built-installers)
- [Dedicated OS Installation Guides](#-dedicated-os-installation-guides)
  - [Linux (AppImage, Deb, Arch)](#linux-installation)
  - [macOS (DMG, Gatekeeper Fix)](#macos-installation)
  - [Windows (NSIS Installer, Portable, SmartScreen)](#windows-installation)
- [Quick Start Guide](#-quick-start-guide)
- [Features & Redesign Showcase](#-features--redesign-showcase)
  - [Stitch UI Redesign & 7 Core Views](#stitch-ui-redesign--7-core-views)
  - [Tri-Theme Engine (Light, Dark, Pure Monochrome)](#tri-theme-engine)
  - [Media Capabilities & Performance](#media-capabilities--performance)
- [Build from Source & Development](#-build-from-source--development)
- [Automated Testing & Verification](#-automated-testing--verification)
- [Architecture & System Design](#-architecture--system-design)
- [License & Acknowledgments](#-license--acknowledgments)

---

## 📦 Downloads & Pre-built Installers

Official standalone release packages for Windows, macOS, and Linux are published on GitHub Releases. Choose the package for your platform below:

| Operating System | Architecture | Package Format | Download Link | Notes |
|:---|:---|:---|:---|:---|
| **Windows** | x64 (64-bit) | NSIS Setup (`.exe`) | [**`Offliner-Setup-1.1.1.exe`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-Setup-1.1.1.exe) | Recommended; desktop & start menu shortcuts |
| **Windows** | x64 (64-bit) | Portable Archive (`.zip`) | [**`Offliner-1.1.1-win-portable.zip`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-win-portable.zip) | Zero installation; extract and run anywhere |
| **macOS** | Universal (Apple Silicon & Intel) | Apple Disk Image (`.dmg`) | [**`Offliner-1.1.1.dmg`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.dmg) | Drag-and-drop to `/Applications` |
| **macOS** | Universal (Apple Silicon & Intel) | Application Bundle (`.zip`) | [**`Offliner-1.1.1-mac.zip`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-mac.zip) | Direct standalone `.app` archive |
| **Linux** | x86_64 | AppImage (`.AppImage`) | [**`Offliner-1.1.1.AppImage`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.AppImage) | Distribution-agnostic single binary |
| **Linux** | x86_64 / amd64 | Debian / Ubuntu (`.deb`) | [**`offliner_1.1.1_amd64.deb`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/offliner_1.1.1_amd64.deb) | Native dpkg/apt package manager install |

👉 **[View All Releases & Checksums on GitHub](https://github.com/KHOJAH/Offliner/releases/latest)**

---

## 🚀 Dedicated OS Installation Guides

### Linux Installation

#### Option 1: One-Line Automated Setup (Recommended for Ubuntu, Debian, Pop!_OS, Arch)

Run this one-line command in your terminal to automatically install required dependencies (`curl`, `ffmpeg`, `nodejs`), download the latest `yt-dlp`, compile the binary, and integrate Offliner directly into your application launcher:

```bash
curl -sSL https://raw.githubusercontent.com/KHOJAH/offliner/main/scripts/setup-linux.sh | bash
```

---

#### Option 2: Standalone AppImage (Distribution-Agnostic)

1. Download [`Offliner-1.1.1.AppImage`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.AppImage).
2. Mark the file as executable:
   ```bash
   chmod +x Offliner-1.1.1.AppImage
   ```
3. Run the application:
   ```bash
   ./Offliner-1.1.1.AppImage
   ```

> **Ubuntu 22.04+ / Debian 12 FUSE Note**: AppImages require FUSE 2. If the AppImage fails to launch with `dlopen(): error loading libfuse.so.2`, install the FUSE library or run in extract mode:
> ```bash
> # Ubuntu / Debian / Pop!_OS:
> sudo apt install -y libfuse2
>
> # Alternative (extract and run directly without FUSE):
> ./Offliner-1.1.1.AppImage --appimage-extract-and-run
> ```

---

#### Option 3: Debian / Ubuntu Package (`.deb`)

1. Download [`offliner_1.1.1_amd64.deb`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/offliner_1.1.1_amd64.deb).
2. Install via `apt` (which resolves any system dependencies automatically):
   ```bash
   sudo apt install ./offliner_1.1.1_amd64.deb
   ```
   *(Or using dpkg: `sudo dpkg -i offliner_1.1.1_amd64.deb && sudo apt install -f`)*
3. Launch Offliner from your desktop application launcher or run `offliner` in terminal.

---

#### Option 4: Arch Linux / Manjaro Desktop Integration

```bash
# 1. Download and place AppImage into your local bin directory
mkdir -p ~/.local/bin ~/.local/share/applications
curl -L https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.AppImage -o ~/.local/bin/offliner
chmod +x ~/.local/bin/offliner

# 2. Create the desktop launcher entry
cat << 'EOF' > ~/.local/share/applications/offliner.desktop
[Desktop Entry]
Name=Offliner
Comment=Desktop Media Downloader
Exec=/home/%u/.local/bin/offliner
Terminal=false
Type=Application
Categories=AudioVideo;Utility;
EOF
```

#### Linux Runtime Prerequisites
Ensure `ffmpeg` and `yt-dlp` are installed for optimal media remuxing and format extraction:
```bash
# Debian / Ubuntu / Mint:
sudo apt update && sudo apt install -y ffmpeg yt-dlp

# Arch Linux / Manjaro:
sudo pacman -S --noconfirm ffmpeg yt-dlp

# Fedora:
sudo dnf install -y ffmpeg yt-dlp
```

---

### macOS Installation

Offliner provides a Universal build compatible with both **Apple Silicon (M1, M2, M3, M4)** and **Intel** Macs.

#### Option 1: DMG Installer (Recommended)

1. Download [`Offliner-1.1.1.dmg`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.dmg).
2. Double-click the `.dmg` file to mount it.
3. Drag **Offliner.app** into the **Applications** folder shortcut.
4. Eject the DMG disk image.
5. Open Offliner via Spotlight (`Cmd + Space` -> `Offliner`) or Launchpad.

---

#### Gatekeeper Quarantine Fix (Unsigned Developer Notice)

Because Offliner is distributed as open-source software outside the Mac App Store without an expensive Apple Developer certificate, macOS Gatekeeper may display:  
> *"Offliner cannot be opened because the developer cannot be verified"* or *"Apple could not verify that Offliner is free of malware"*.

To resolve this instantly, remove the quarantine attribute using Terminal:

```bash
xattr -cr /Applications/Offliner.app
```

*Alternatively, right-click (or Control-click) `Offliner.app` in Finder, choose **Open**, and click **Open** in the confirmation dialog.*

#### macOS Runtime Prerequisites
For maximum DASH remuxing performance and audio extraction, install `ffmpeg` and `yt-dlp` using [Homebrew](https://brew.sh):

```bash
brew install ffmpeg yt-dlp

# (Optional, recommended for YouTube challenge token solving)
brew install deno
```

---

### Windows Installation

#### Option 1: NSIS Setup Installer (Recommended)

1. Download [`Offliner-Setup-1.1.1.exe`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-Setup-1.1.1.exe).
2. Run the executable.
3. Choose your preferred install directory (defaults to `%LOCALAPPDATA%\Programs\Offliner`).
4. Select "Create Desktop Shortcut" and complete installation.
5. Launch **Offliner** from the Desktop shortcut or Start Menu.

---

#### Option 2: Portable Edition (No Installation Required)

1. Download [`Offliner-1.1.1-win-portable.zip`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-win-portable.zip).
2. Extract the ZIP archive to any directory (e.g., `C:\Tools\Offliner` or a USB drive).
3. Double-click `Offliner.exe` to run immediately.

---

#### Windows SmartScreen Bypass Notice

Windows Defender SmartScreen may display:  
> *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*

Because this open-source executable does not have an EV code-signing certificate, simply:
1. Click **"More info"**.
2. Click **"Run anyway"**.

#### Windows Runtime Prerequisites
Offliner includes pre-bundled `ffmpeg.exe` in its binaries folder. To ensure system-wide availability:
```powershell
# Using Windows Package Manager (winget):
winget install Gyan.FFmpeg yt-dlp.yt-dlp

# Or using Scoop:
scoop install ffmpeg yt-dlp
```

---

## ⚡ Quick Start Guide

Once launched, Offliner is ready to use out-of-the-box:

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Paste URL       Paste any YouTube video, shorts, or playlist link   │
│ 2. Smart Ingest    Offliner auto-detects content & routes to best view │
│ 3. Select Format   Pick 4K/1080p video, FLAC/MP3 audio, or trim clips  │
│ 4. Queue & Manage  Bounded concurrency engine downloads with progress  │
│ 5. Native Open     Directly open file or reveal in system file manager │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Paste any Link**: Paste a YouTube video, playlist, or audio URL into the Universal Input on the **Home** view.
2. **Auto-Route**: Offliner's smart resolver inspects the link structure and routes you directly to the relevant view (Video, Audio Studio, or Playlist Batcher).
3. **Configure Options**:
   - **Video**: Select target resolution (4K, 1440p, 1080p, 720p) and container (MP4, MKV, WebM).
   - **Audio**: Choose from 6 extraction codecs (MP3, M4A, FLAC, WAV, OPUS, AAC) and bitrate slider.
   - **Clips**: Drag the visual start and end scrubber handles or type exact timestamps to cut a segment.
4. **Enqueue & Download**: Click **Download** or **Add to Queue**. Head to the **Queue** view to observe real-time speed (MB/s), smooth progress bars, and ETA.
5. **Manage Tasks**: Pause, resume, or cancel active transfers at any time.

---

## 🎨 Features & Redesign Showcase

### Stitch UI Redesign & 7 Core Views

Offliner's user interface has been redesigned based on extracted design deliverables from **Google Stitch project 8104687579869282491** (`docs/stitch/`), combining the tactical clarity of Apple Human Interface Guidelines with the calm warm minimalism of Anthropic Claude.

| # | Screen | Description | Design Artifact |
|:---:|:---|:---|:---|
| **1** | **Universal Resolver (Home)** | Central ingestion hub with smart URL routing, quick-action mode cards, and system status indicators. | `docs/stitch/screens/01_home_resolver.html` |
| **2** | **Video Studio** | High-resolution video downloader supporting DASH 4K/1080p muxing, format badges, and inline clip trimmer. | `docs/stitch/screens/02_video_download.html` |
| **3** | **Audio Studio** | Dedicated audio extraction engine with 6 codecs, bitrate quality slider (0–9), and duplicate-stream prevention. | `docs/stitch/screens/03_audio_extract.html` |
| **4** | **Playlist Batcher** | Fast playlist inspection (`--flat-playlist`), individual track selection, master toggle, and batch format sync. | `docs/stitch/screens/04_playlist_batch.html` |
| **5** | **Clips Precision Trimmer** | Dual-handle timeline scrubber, millisecond-accurate HH:MM:SS inputs, and multi-cut queue builder. | `docs/stitch/screens/05_clips_trimmer.html` |
| **6** | **Transfers Queue** | Bounded concurrency manager (1–8 parallel slots), rolling average speed/ETA, and pause/resume/cancel controls. | `docs/stitch/screens/06_queue_manager.html` |
| **7** | **Preferences / Settings** | Native download directory picker, concurrency limiter, auto-update toggle, and theme engine switcher. | `docs/stitch/screens/07_settings.html` |

<br />

#### View Previews

**1. Home View (Universal Resolver)**  
*Universal entry with instant URL inspection, quick action dispatch cards, and system runtime indicators.*  
<p align="center"><img src="Pics/1.png" alt="Offliner Home View" width="850" /></p>

**2. Video View (DASH & Resolution Selector)**  
*Select up to 4K/8K resolutions with DASH video + audio container merging, FPS badges, and inline clipping.*  
<p align="center"><img src="Pics/2.png" alt="Offliner Video View" width="850" /></p>

**3. Audio Studio (High-Fidelity Extraction)**  
*Direct audio extraction into MP3, M4A, FLAC, WAV, OPUS, or AAC with stepped compression control.*  
<p align="center"><img src="Pics/3.png" alt="Offliner Audio Studio" width="850" /></p>

**4. Playlist Batch Downloader**  
*Inspect entire playlists at once, select specific tracks, synchronize formats, and enqueue in bulk.*  
<p align="center"><img src="Pics/4.png" alt="Offliner Playlist View" width="850" /></p>

**5. Clips Precision Trimmer**  
*Dual-handle interactive timeline scrubber with start/end time inputs for keyframe-accurate cuts.*  
<p align="center"><img src="Pics/5.png" alt="Offliner Clips Trimmer View" width="850" /></p>

---

### Tri-Theme Engine

Offliner includes three meticulously crafted visual themes with zero-flicker transitions and automatic system dark-mode detection:

1. **Light Mode (Daylight)**:
   - Background: `#FAFAF8` (Warm Daylight)
   - Surface: `#FFFFFF` with hairline borders (`rgba(0, 0, 0, 0.08)`)
   - Accent: `#0071E3` (Apple Signature Blue)
2. **Dark Mode (Obsidian)**:
   - Background: `#0D0E11` (Deep Obsidian)
   - Surface: `#17181C` / `#222328` with hairline borders (`rgba(255, 255, 255, 0.08)`)
   - Accent: `#2997FF` (Electric Azure)
3. **Monochrome Mode (Noir — 0% Chroma)**:
   - Background: `#000000` (Pure Noir)
   - Surface: `#121212` / `#1E1E1E` with `#262626` borders
   - Accent: `#FFFFFF` (Pure Chalk White)
   - **Mathematically Pure**: Every single token satisfies $R = G = B$, yielding an exact saturation of $S = 0.0000\%$ with zero chromatic color leakage.

Cycle themes anytime using the theme button in the top navigation bar or under **Settings** (`Light` → `Dark` → `Monochrome`).

---

### Media Capabilities & Performance

- **DASH Video & Audio Stream Merging**: Merges highest quality video and audio streams seamlessly into MP4 or MKV containers using FFmpeg.
- **Keyframe-Accurate Segment Trimming**: Utilizes `--force-keyframes-at-cuts` and `-short_seek_size 1` to produce frame-accurate cuts without black frames or frozen video at clip boundaries.
- **6-Codec Audio Studio**: Lossless and high-bitrate audio extraction for FLAC, WAV, MP3 (320kbps), M4A (AAC), OPUS, and native AAC.
- **Duplicate Echo Prevention**: Configures `--audio-multistreams` and single audio stream routing to eliminate playback echo.
- **Bounded Concurrency Queue**: Regulates active parallel downloads between 1 and 8 concurrent tasks (default 3), protecting network bandwidth and CPU resources.
- **True Pause & Resume**: Pausing a download cleanly terminates the child process while preserving the partial download (`.part` file); resuming continues the byte stream with `--continue`.
- **Rolling Metric Smoothing**: Speed and ETA measurements are calculated using a 3-second rolling window to eliminate progress bar jitter.

---

## 🛠 Build from Source & Development

If you prefer building from source or contributing to Offliner:

### Prerequisites
- **Node.js**: `v18.0.0` or higher (verified on Node 20 and Node 26)
- **npm**: `v9.0.0` or higher
- **FFmpeg**: Available on system `PATH`
- **yt-dlp**: Available on system `PATH` or updated via the automated script

### Clone & Install

```bash
# 1. Clone repository
git clone https://github.com/KHOJAH/Offliner.git
cd Offliner

# 2. Install dependencies
npm install

# 3. Update / verify yt-dlp binary
npm run update:binaries
```

### Development Scripts

| Command | Action |
|:---|:---|
| `npm run dev` | Launch development server with Vite HMR, Electron main process, and DevTools. |
| `npm run build` | Compile TypeScript (`tsc --noEmit`) and bundle renderer, main, preload, and worker with Vite. |
| `npx electron .` | Launch compiled production bundles (`dist/`) directly in Electron without packaging. |
| `npm run build:desktop` | Execute prebuild icon conversion, binary sync, and package platform installers via `electron-builder`. |
| `npm run typecheck` | Run TypeScript strict compiler checks with 0 emit (`tsc --noEmit`). |
| `npm test` | Run the complete Vitest automated test suite (474 tests, Tiers 1–5). |
| `npm run lint` | Run ESLint across TypeScript and TSX source files. |
| `npm run format` | Format source files with Prettier. |

### Packaging Standalone Binaries

```bash
# Creates platform packages in release/ directory:
npm run build:desktop
```
- **Linux**: `release/Offliner-1.1.1.AppImage` & `release/offliner_1.1.1_amd64.deb`
- **Windows**: `release/Offliner Setup 1.1.1.exe`
- **macOS**: `release/Offliner-1.1.1.dmg`

> **Note**: Cross-packaging Windows NSIS from Linux requires `wine`; macOS DMGs require a macOS host.

---

## 🧪 Automated Testing & Verification

Offliner features a comprehensive, 5-tier automated testing suite engineered with Vitest to guarantee zero regressions:

```bash
npm test
```

```
 Test Files  35 passed (35)
      Tests  541 passed (541)
   Duration  ~7.7s
```

### Test Tiers Architecture

- **Tier 1: Core Unit Features (144 tests)**: CLI command builders, stream progress regex parsers, error parsers, mock process runner, queue state transitions.
- **Tier 2: Boundary Conditions (40 tests)**: Zero/negative concurrency clamping, out-of-range timeline sliders, malformed YouTube URLs, empty playlist handling, non-existent files.
- **Tier 3: Multi-Feature Combinations (16 tests)**: DASH video muxing + audio extraction, timeline multi-clipping + queue state transitions, concurrent batch downloads.
- **Tier 4: Real-World Resilience (5 tests)**: Process tree SIGKILL terminations, network timeouts, stream stalling, pause/resume `.part` file preservation, YouTube challenge token injection.
- **Tier 5: Adversarial Hardening (336 tests)**: High-concurrency rule registration, unhandled rejection leak prevention, mathematical RGB chroma verification (0% color leakage in Monochrome mode), and automated UI copy inspection guaranteeing zero engineering jargon across all views.

To verify TypeScript contracts and run tests locally:
```bash
npm run typecheck && npm test
```

---

## 🏛 Architecture & System Design

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Desktop UI Layer (React)                        │
│  - Minimal Apple / Claude Design System                                │
│  - Switchable Tri-Themes: Light, Dark, Monochrome (0% Chroma)          │
│  - 7 Core Views: Home, Video, Audio, Playlist, Clips, Queue, Settings  │
│  - Smooth Spring Animations (cubic-bezier(0.16, 1, 0.3, 1))            │
│  - Google Stitch Design Deliverables (docs/stitch/)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ State & IPC Bridge
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Zustand State Stores Core                        │
│  - DownloadQueueEngine (Concurrency 1-8, Priority Scheduling)          │
│  - DownloadStore (Active, Queued, Completed, Failed, Trash)            │
│  - SettingsStore (Directories, Default Formats, Concurrency, Theme)    │
│  - UIStore (Navigation, Toasts, Active Modals)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IProcessRunner Engine Interface
┌───────────────────────────────────▼────────────────────────────────────┐
│                       Media Process Orchestration                      │
│  - Production Engine: yt-dlp & ffmpeg Child Processes                  │
│  - Deterministic Mock Engine (for 100% offline CI testing)             │
│  - Regex Parsers (yt-dlp stream progress + ffmpeg time/speed)          │
│  - Process Tree Terminations (SIGKILL / taskkill for pause/cancel)     │
└────────────────────────────────────────────────────────────────────────┘
```

- **Renderer Process**: Pure React 18 SPA with Tailwind CSS, running in an isolated context (`contextIsolation: true`).
- **Main Process**: Electron lifecycle manager, custom frameless window, system tray, and auto-updater.
- **Worker Process**: Headless Node.js process (`ELECTRON_RUN_AS_NODE: '1'`) managing `DownloadQueueEngine` and spawning `yt-dlp` / `ffmpeg` child processes with non-blocking stream communication.
- **IPC Protocol**: Structured, newline-delimited JSON IPC bridge with type-safe message schemas.

---

## 📄 License & Acknowledgments

- **License**: Released under the [MIT License](LICENSE).
- **Core Media Tools**: Built upon [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org).
- **UI Design**: Exported and adapted from [Google Stitch](https://stitch.withgoogle.com/) Project `8104687579869282491`.
- **Author**: Ramez Khojah (<Khojahramez29@gmail.com>).
