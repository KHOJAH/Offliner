# Offliner: System Design & Architecture

Welcome to the Offliner codebase! This document is designed to give new developers a clear mental model of how the application is structured, how data flows through the system, and how the core downloading engine works.

## 1. High-Level Architecture

Offliner is built using **Electron**, **React**, and **TypeScript**. It follows a multi-process architecture to ensure the user interface remains responsive even during resource-intensive operations.

### The Process Model

1.  **Renderer Process (UI)**
    - **Tech:** React + Vite + Zustand + CSS Modules.
    - **Role:** Handles user interactions, displays the download queue, and manages local UI state.
    - **Constraint:** It has no direct access to the file system or shell for security reasons. It communicates with the Main process via a Preload script.

2.  **Main Process (Orchestrator)**
    - **Tech:** Electron (Node.js environment).
    - **Role:** Manages the window lifecycle, system tray, auto-updates, and persists settings via `electron-store`.
    - **Bridge:** It acts as the "middleman," routing requests from the Renderer to the Worker process.

3.  **Worker Process (Download Engine)**
    - **Tech:** Pure Node.js (spawned by Main with `ELECTRON_RUN_AS_NODE=1`).
    - **Role:** This is the core "heavy lifter." It manages the download queue, spawns `yt-dlp` child processes, and parses CLI output.
    - **Isolation:** By running in a separate process, long-running CLI operations or potential crashes in `yt-dlp` won't freeze the Main process or the UI.

---

## 2. Communication & IPC Strategy

The app uses two different communication layers:

### Renderer ↔ Main (Electron IPC)
Standard Electron IPC is used for UI-triggered actions.
- **Renderer to Main:** `ipcRenderer.invoke` (e.g., `addDownload`, `openFolder`).
- **Main to Renderer:** `webContents.send` (e.g., `download-progress`, `download-complete`).

### Main ↔ Worker (Custom JSON-RPC)
Since the Worker is a separate Node.js process, communication happens over `stdin` and `stdout` using a JSON-RPC style protocol.
- **Command Path:** Main writes a JSON string to Worker's `stdin` (`{ type: 'START_DOWNLOAD', payload: { ... } }`).
- **Event Path:** Worker writes JSON strings to its `stdout`. The Main process listens for these, parses them, and forwards relevant data to the Renderer.

---

## 3. The "Life of a Download" Flow

To understand the codebase, follow a single download request from start to finish:

1.  **Request:** User submits a URL in `URLInput.tsx`.
2.  **UI State:** `downloadStore.ts` adds a "pending" entry to the Zustand store.
3.  **Bridge:** Renderer calls `ipc.addDownload(url)` (defined in `src/renderer/ipc/client.ts`).
4.  **Route:** `src/main/ipc.ts` receives the IPC call and sends a `DOWNLOAD_ADD` command to the Worker's `stdin`.
5.  **Queue:** `src/worker/queue.ts` receives the command. If the max concurrency (default: 3) is reached, it waits; otherwise, it triggers the download.
6.  **Execute:** `src/worker/ytdlp.ts` spawns the `yt-dlp` child process with specific flags (e.g., `--newline`, `--progress`).
7.  **Parse:** `src/worker/progress-parser.ts` monitors the `yt-dlp` `stdout`. It uses regex to convert raw strings like `[download]  10% of 100MiB at 1MiB/s...` into structured JSON.
8.  **Update:**
    - Worker writes progress JSON to `stdout`.
    - Main parses it and calls `webContents.send('download-progress', ...)`.
    - Renderer's `downloadStore` updates the specific item, causing `DownloadCard.tsx` to re-render with the new progress.

---

## 4. Binary Management (`yt-dlp` & `ffmpeg`)

Offliner is a wrapper around these two powerful CLI tools.

- **Storage:** During development, binaries are stored in `build/`. In production, they are bundled as `extraResources`.
- **Path Resolution:** The `YtDlp` class in `src/worker/ytdlp.ts` automatically detects whether it's running in a dev or packaged environment to locate the correct binary paths.
- **FFmpeg:** Used by `yt-dlp` to merge high-quality video and audio streams into a single file.

---

## 5. Persistence & State

- **Zustand (Memory):** Manages all active UI state. It's fast and reactive but cleared when the app closes.
- **Electron Store (Disk):** Persists the download history and user settings (e.g., download location, format preferences). When the app starts, the Main process reads this store and hydrates the Renderer.

---

## 6. Developer Onboarding Quick Start

### 1. Prerequisites
- Node.js (Latest LTS recommended).
- `yt-dlp.exe` and `ffmpeg.exe` must be present in the `build/` directory for Windows development.

### 2. Commands
- `npm install`: Install dependencies.
- `npm run dev`: Start the application with hot-reloading.
- `npm test`: Run the Vitest suite (essential for checking the progress parser).

### 3. Key Files to Know
- `src/main/ipc.ts`: The central router for all IPC traffic.
- `src/worker/queue.ts`: Where the download logic is orchestrated.
- `src/renderer/stores/downloadStore.ts`: The source of truth for the UI.
- `src/worker/progress-parser.ts`: The regex-heavy logic for CLI parsing.