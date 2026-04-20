# Offliner

Offliner is a YouTube downloader built for the desktop. It's designed to be fast and look good on your screen, using a glass-style UI that fits into modern operating systems. It handles everything from single videos and playlists to extracting just the audio.

<img src="Pics/logo.png" width="200">

## Core Features

- **Full YouTube Support**: Paste any YouTube link to start a download.
- **Playlist Downloads**: Give it a playlist URL and it will fetch every video in the list.
- **Audio Extraction**: Option to save files as MP3 or M4A if you only want the sound.
- **Custom Clipping**: Use the timeline slider to select a specific part of a video and download just that segment.
- **Batch Queue**: Add multiple videos to a list and let them download in order. You can pause or resume individual tasks whenever you need.
- **Quality Selection**: Choose your preferred resolution and format before starting.
- **Automatic Updates**: The app checks for new versions and updates itself so you always have the latest fixes.
- **Native Experience**: Custom title bar and window controls designed to look like a native app.

## View Previews

| Feature | Description |
|---------|-------------|
| **Home** | The starting point for pasting your links. |
| **Video/Audio** | Dedicated views for high-quality downloads. |
| **Playlist** | Manage and download entire collections. |
| **Clips** | The precision trimming tool for specific moments. |
| **Queue** | Monitor your progress and manage active downloads. |

**Home**
   * Universal Entry: The central place to paste any link (Video, Audio, or Playlist).
   * Smart Routing: It automatically detects the link type and sends you to the correct tab (e.g., if you paste a playlist,
     it jumps straight to the Playlist view).
   * Quick Actions: Shortcuts to jump directly into specific download modes.

![alt text](Pics/1.png)

 **Video**
   * High-Quality Downloads: Supports full video downloads in multiple resolutions (up to 4K/8K depending on the source).
   * Format Selection: Choose between MP4, MKV, or WebM formats.
   * Smart Metadata: Displays video title, uploader, views, and duration before you start.

![alt text](Pics/2.png)

**Audio**
   * Studio Quality Extraction: Extracts audio directly from videos with zero quality loss.
   * Format Options: Supports high-bitrate MP3, M4A, WAV, or FLAC.
   * Podcast Ready: Ideal for saving music, interviews, or lectures as standalone audio files.

![alt text](Pics/3.png)

**Playlist**
   * Batch Processing: Paste a single link to see every video in a playlist.
   * Selective Download: You can check/uncheck specific videos to only download what you need.
   * Format Sync: Set a single format (like MP4 or MP3) for the entire playlist and download them all at once.

   ![alt text](Pics/4.png)

**Clips** (Advanced Feature)
   * Precise Trimming: Don't need the whole 10-minute video? Use the visual timeline to pick start and end times.
   * Multiple Clips: You can add several different parts of the same video to a list (e.g., "Clip 1" at 0:30 and "Clip 2" at
     5:00).
   * Bulk Clipping: Download all your selected snippets as separate files in one click.

   ![alt text](Pics/5.png)

   **Queue**
   * Active Monitoring: See real-time progress bars, download speeds (MB/s), and estimated time remaining (ETA).
   * Management: Pause, resume, or cancel downloads that are currently running.
   * History: See a list of your completed downloads with one-click buttons to Open File or Show in Folder.

   **Settings**
   * Customization: Change your default download folder so you never have to pick it twice.
   * Appearance: Switch between Light, Dark, and the signature Glass themes.
   * Performance: Set how many downloads can run at the same time (Concurrency) and toggle Auto-Updates.
## How to use

### Requirements
- Node.js 18 or higher
- npm

### Setup
1. Clone this repo.
2. Run `npm install` to get the dependencies.
3. Use `npm run dev` to start the app in development mode.
4. Use `npm run build` to create a standalone installer for your machine.

## Tech stack
This is built with Electron and React (TypeScript). It uses yt-dlp and ffmpeg under the hood to handle the actual downloading and processing of the media.
