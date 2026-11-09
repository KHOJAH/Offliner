# Offliner

<p align="center">
  <img src="Pics/logo.png" alt="Offliner Logo" width="180" />
</p>

<p align="center">
  <strong>A minimal, fast desktop media downloader.</strong><br />
  Built with Electron, React, TypeScript, and Tailwind CSS. Powered by <code>yt-dlp</code> and <code>ffmpeg</code>.
</p>

<p align="center">
  <a href="https://github.com/KHOJAH/Offliner/releases/latest"><img src="https://img.shields.io/github/v/release/KHOJAH/Offliner?style=flat-square&color=2997FF&label=Release" alt="Latest Release" /></a>
  <a href="https://github.com/KHOJAH/Offliner"><img src="https://img.shields.io/badge/Tests-541%20Passing-30D158?style=flat-square" alt="Tests" /></a>
  <a href="https://github.com/KHOJAH/Offliner/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey?style=flat-square" alt="Cross-Platform" />
</p>

---

## Table of Contents

- [Downloads](#downloads)
- [Installation](#installation)
  - [Linux](#linux)
  - [macOS](#macos)
  - [Windows](#windows)
- [Quick Start](#quick-start)
- [Features](#features)
  - [Core Views](#core-views)
  - [Themes](#themes)
  - [Media Capabilities](#media-capabilities)
- [Build from Source](#build-from-source)
- [Testing](#testing)
- [Architecture](#architecture)
- [License](#license)

---

## Downloads

Standalone packages for Windows, macOS, and Linux are available on GitHub Releases:

| Operating System | Architecture | Format | Download | Notes |
|:---|:---|:---|:---|:---|
| **Windows** | x64 (64-bit) | Installer (`.exe`) | [**`Offliner-Setup-1.1.1.exe`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-Setup-1.1.1.exe) | Recommended; desktop and start menu shortcuts |
| **Windows** | x64 (64-bit) | Portable (`.zip`) | [**`Offliner-1.1.1-win-portable.zip`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-win-portable.zip) | No installation required |
| **macOS** | Universal (Silicon & Intel) | Disk Image (`.dmg`) | [**`Offliner-1.1.1.dmg`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.dmg) | Drag and drop into Applications |
| **macOS** | Universal (Silicon & Intel) | Application (`.zip`) | [**`Offliner-1.1.1-mac.zip`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-mac.zip) | Standalone `.app` bundle |
| **Linux** | x86_64 | AppImage (`.AppImage`) | [**`Offliner-1.1.1.AppImage`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.AppImage) | Works on all major distributions |
| **Linux** | x86_64 / amd64 | Debian Package (`.deb`) | [**`offliner_1.1.1_amd64.deb`**](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/offliner_1.1.1_amd64.deb) | Ubuntu, Debian, Pop!_OS, and Mint |

**[View all releases and checksums on GitHub](https://github.com/KHOJAH/Offliner/releases/latest)**

---

## Installation

### Linux

#### Option 1: AppImage (Recommended)

1. Download [`Offliner-1.1.1.AppImage`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.AppImage).
2. Make it executable:
   ```bash
   chmod +x Offliner-1.1.1.AppImage
   ```
3. Run the application:
   ```bash
   ./Offliner-1.1.1.AppImage
   ```

> If your system lacks FUSE 2 (e.g. Ubuntu 22.04+), install it or run with the extract flag:
> ```bash
> sudo apt install -y libfuse2
> # Or run directly:
> ./Offliner-1.1.1.AppImage --appimage-extract-and-run
> ```

#### Option 2: Debian / Ubuntu Package (`.deb`)

1. Download [`offliner_1.1.1_amd64.deb`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/offliner_1.1.1_amd64.deb).
2. Install via apt:
   ```bash
   sudo apt install ./offliner_1.1.1_amd64.deb
   ```
3. Open Offliner from your application menu or run `offliner` in a terminal.

#### Option 3: Automated Script

```bash
curl -sSL https://raw.githubusercontent.com/KHOJAH/offliner/main/scripts/setup-linux.sh | bash
```

#### System Dependencies

Ensure `ffmpeg` and `yt-dlp` are present on your system:

```bash
# Ubuntu / Debian / Mint:
sudo apt update && sudo apt install -y ffmpeg yt-dlp

# Arch Linux / Manjaro:
sudo pacman -S ffmpeg yt-dlp

# Fedora:
sudo dnf install ffmpeg yt-dlp
```

---

### macOS

Offliner runs natively on both Apple Silicon (M1/M2/M3/M4) and Intel Macs.

#### Option 1: DMG Installer

1. Download [`Offliner-1.1.1.dmg`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1.dmg).
2. Double-click the `.dmg` file.
3. Drag **Offliner.app** into the **Applications** folder.
4. Launch Offliner from Spotlight (`Cmd + Space` -> `Offliner`) or Launchpad.

#### Gatekeeper Notice

If macOS displays a warning that the developer cannot be verified:

```bash
xattr -cr /Applications/Offliner.app
```

*Or right-click `Offliner.app` in Finder, select **Open**, and confirm.*

#### System Dependencies

For optimal speed and remuxing quality, install `ffmpeg` and `yt-dlp` via Homebrew:

```bash
brew install ffmpeg yt-dlp
```

---

### Windows

#### Option 1: Installer Setup

1. Download [`Offliner-Setup-1.1.1.exe`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-Setup-1.1.1.exe).
2. Run the installer and follow the prompts.
3. Launch **Offliner** from your Desktop or Start Menu.

#### Option 2: Portable Edition

1. Download [`Offliner-1.1.1-win-portable.zip`](https://github.com/KHOJAH/Offliner/releases/download/v1.1.1/Offliner-1.1.1-win-portable.zip).
2. Extract the archive to any folder.
3. Run `Offliner.exe`.

#### SmartScreen Notice

If Windows SmartScreen shows a prompt:
1. Click **More info**.
2. Click **Run anyway**.

#### System Dependencies

Offliner includes pre-bundled binaries. To install them system-wide:

```powershell
# Using winget:
winget install Gyan.FFmpeg yt-dlp.yt-dlp

# Or using Scoop:
scoop install ffmpeg yt-dlp
```

---

## Quick Start

1. **Paste Link**: Paste any media link into the search bar.
2. **Choose View**: Offliner routes to Video, Audio, or Playlist mode.
3. **Select Quality**:
   - **Video**: Choose resolution up to 4K and container format (MP4, MKV, WebM).
   - **Audio**: Choose extraction format (MP3, M4A, FLAC, WAV, OPUS, AAC) and bitrate.
   - **Clips**: Adjust start and end handles on the timeline to trim a segment.
4. **Download**: Click **Download** or **Add to Queue** to track progress with speed and ETA.
5. **Open File**: When finished, click to play or reveal in your file manager.

---

## Features

### Core Views

| Screen | Purpose |
|:---|:---|
| **Home** | Clean input for links with quick action cards. |
| **Video** | High-definition downloads up to 4K with format and quality options. |
| **Audio** | Audio extraction with 6 formats and quality presets. |
| **Playlists** | Batch downloader with individual track selection. |
| **Clips** | Timeline trimmer for keyframe-accurate video segments. |
| **Queue** | Active and completed transfers with pause, resume, and speed metrics. |
| **Settings** | Destination folder, concurrent downloads, and theme controls. |

#### Screenshots

**Home**  
<p align="center"><img src="Pics/1.png" alt="Home View" width="850" /></p>

**Video**  
<p align="center"><img src="Pics/2.png" alt="Video View" width="850" /></p>

**Audio**  
<p align="center"><img src="Pics/3.png" alt="Audio View" width="850" /></p>

**Playlists**  
<p align="center"><img src="Pics/4.png" alt="Playlist View" width="850" /></p>

**Clips**  
<p align="center"><img src="Pics/5.png" alt="Clips View" width="850" /></p>

---

### Themes

Offliner includes three carefully balanced appearance modes:

1. **Light**: Clean daylight theme with high readability.
2. **Dark**: Deep obsidian dark mode for low-light environments.
3. **Monochrome**: Pure achromatic black-and-white mode ($R=G=B$, 0% color saturation).

Switch themes from the top navigation bar or under **Settings**.

---

### Media Capabilities

- **High-Resolution Video**: Supports 4K and 1080p formats with automatic video and audio stream merging.
- **Precision Trimming**: Keyframe-accurate clipping without freeze frames at cut boundaries.
- **Audio Extraction**: Clean conversion to MP3, M4A, FLAC, WAV, OPUS, and AAC.
- **Parallel Queue**: Configurable concurrent downloads (1 to 8 parallel tasks).
- **Pause and Resume**: Pauses downloads cleanly and resumes without restarting from scratch.
- **Smooth Metrics**: Real-time download speeds and estimated completion times.

---

## Build from Source

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- FFmpeg and yt-dlp installed on system PATH

### Clone and Install

```bash
git clone https://github.com/KHOJAH/Offliner.git
cd Offliner
npm install
npm run update:binaries
```

### Scripts

| Command | Action |
|:---|:---|
| `npm run dev` | Start development server with hot reload and Electron window. |
| `npm run build` | Compile TypeScript and bundle with Vite. |
| `npx electron .` | Launch compiled production build. |
| `npm run build:desktop` | Build platform installers using electron-builder. |
| `npm run typecheck` | Run TypeScript type checking. |
| `npm test` | Run the Vitest test suite. |
| `npm run lint` | Run ESLint. |

---

## Testing

Offliner includes an automated test suite with 541 passing tests:

```bash
npm test
```

```
 Test Files  35 passed (35)
      Tests  541 passed (541)
   Duration  ~7.7s
```

Test coverage includes:
- Core unit functionality (CLI builders, progress parsing, queue engine)
- Boundary conditions (concurrency limits, edge-case URLs, empty playlists)
- Multi-feature workflows (DASH muxing, audio extraction, clip queues)
- Process resilience (clean cancellations, pause/resume state preservation)
- Adversarial hardening (monochrome color invariance, UI copy verification)

---

## Architecture

```
+------------------------------------------------------------------------+
|                        Desktop UI Layer (React)                        |
|  - Minimal design inspired by Apple and Claude                         |
|  - Tri-Theme Engine: Light, Dark, Monochrome                           |
|  - 7 Core Views: Home, Video, Audio, Playlist, Clips, Queue, Settings  |
+-----------------------------------┬------------------------------------+
                                    | State & IPC Bridge
+-----------------------------------v------------------------------------+
|                       Zustand State Stores Core                        |
|  - DownloadQueueEngine (Concurrency 1-8, Priority Scheduling)          |
|  - DownloadStore (Active, Queued, Completed, Failed, Trash)            |
|  - SettingsStore (Directories, Default Formats, Concurrency, Theme)    |
|  - UIStore (Navigation, Toasts, Active Modals)                         |
+-----------------------------------┬------------------------------------+
                                    | IProcessRunner Interface
+-----------------------------------v------------------------------------+
|                       Media Process Orchestration                      |
|  - Production Engine: yt-dlp & ffmpeg Child Processes                  |
|  - Deterministic Mock Engine (for CI testing)                          |
|  - Regex Parsers (yt-dlp stream progress + ffmpeg time/speed)          |
|  - Clean Process Termination (SIGKILL / taskkill for pause/cancel)     |
+------------------------------------------------------------------------+
```

- **Renderer**: React 18 SPA with Tailwind CSS, running with isolated context.
- **Main**: Electron lifecycle manager, custom window framing, tray, and auto-updater.
- **Worker**: Background Node.js process managing download concurrency and media child processes.
- **IPC Protocol**: Type-safe newline-delimited JSON IPC bridge.

---

## License

- **License**: Released under the [MIT License](LICENSE).
- **Core Media Tools**: Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [FFmpeg](https://ffmpeg.org).
- **Author**: Ramez Khojah (<Khojahramez29@gmail.com>).
