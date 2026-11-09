---
system: "Offliner Google Stitch Prompts"
version: "2.0.0"
created: "2026-11-07"
author: "Offliner Core Team"
platform: "Google Stitch (stitch.withgoogle.com)"
design_language: "Apple HIG + Claude Warm Minimalism"
---

# Google Stitch Canvas Prompts & View Architecture

## 1. System Persona & Global Context Prompt

```markdown
Act as an Apple Human Interface Guidelines and Anthropic Claude UI design expert.
Generate clean, semantic, self-contained HTML5 templates styled with Tailwind CSS
reflecting the Offliner media downloader.
The interface features frosted glass cards, hairline borders, SF Pro/Inter typography,
fluid spring animations (cubic-bezier(0.16, 1, 0.3, 1)), and a live 3-mode theme switcher (Light, Dark, Monochrome).
Monochrome mode strictly satisfies 0% chromatic saturation (R=G=B for all colors).
```

---

## 2. Screen Generation Prompts

### Screen 1: `01_home_resolver.html` (Universal Link Ingestion & Action Dispatch)
- **Prompt**:
  ```markdown
  Design a desktop app home canvas for "Offliner" - a high-performance offline media downloader.
  Include macOS-style window controls (traffic lights), brand title OFFLINER, 7 navigation tabs
  (Home, Video, Audio, Playlist, Clips, Queue, Settings), and an interactive 3-state theme toggle
  (Light, Dark, Monochrome) in the top glass navigation bar.
  The body features a centered hero section with 48px title "OFFLINER" and subtitle "The fastest, most elegant media capture desktop tool."
  A wide omnibox URL input bar features a paste button, clear button, and an active "Analyze URL" action.
  Below, render a 3-column quick action grid:
  1. Full HD Video (links to 02_video_download.html)
  2. Studio Audio (links to 03_audio_extract.html)
  3. Precision Clips (links to 05_clips_trimmer.html)
  Include a "Recent Media" section showing 2 mock resolved videos with high-res thumbnails, duration badge, 4K resolution pill, and instant Re-Download action.
  ```

### Screen 2: `02_video_download.html` (Single Video Stream Selector & Inline Trimmer)
- **Prompt**:
  ```markdown
  Design the Single Video Download view for Offliner.
  Top glass navbar with window controls, 7 tabs, and theme switcher.
  URL input bar displaying resolved URL "https://www.youtube.com/watch?v=dQw4w9WgXcQ".
  Metadata card with 16:9 thumbnail, duration badge "03:33", title "Rick Astley - Never Gonna Give You Up (Official Music Video)", uploader, and view count.
  Format & Quality selector card featuring:
  - Resolution pills: 4K (2160p60) • 420 MB, 1440p • 250 MB, 1080p60 • 120 MB (Selected), 720p • 68 MB, 480p • 35 MB.
  - Container format switch: MP4 (Active) vs MKV.
  - DASH stream notification banner explaining seamless audio+video merging via ffmpeg.
  - Expandable inline clip trimmer accordion with toggle switch and Start/End timestamp inputs (00:00:30 to 00:02:15).
  - Floating primary CTA button "Download Video (1080p60 • 120 MB)".
  ```

### Screen 3: `03_audio_extract.html` (Dedicated Audio Extraction & Quality Slider)
- **Prompt**:
  ```markdown
  Design the Dedicated Audio Extraction canvas for Offliner.
  Metadata card with audio cover art, title, artist, and duration badge.
  Codec selection card with pill group: MP3, M4A, FLAC (Lossless) (Selected), WAV, OPUS, AAC.
  Stepped quality compression slider (0=Best/Lossless to 9=Smallest) showing live bitrate readout:
  "Bit-Perfect Lossless FLAC extraction (Original Bitrate / 24-bit 48kHz)".
  Audio duplicate multistream echo prevention toggle switch (--audio-multistreams filter active).
  Inline clip trimmer accordion with Start and End time inputs.
  Primary CTA button "Extract Audio (FLAC Lossless)".
  ```

### Screen 4: `04_playlist_batch.html` (Playlist Batch Inspector & Format Synchronization)
- **Prompt**:
  ```markdown
  Design the Playlist Batch Download view for Offliner.
  Playlist overview card with collage thumbnail, title "Electronic Music Showcase 2026", total count "12 videos", and total duration "48m 12s".
  Batch format synchronization bar:
  - Mode toggle: Video vs Audio
  - Resolution selector: 1080p (FHD)
  - Container: MP4
  Master selection control header: Master checkbox, "10 of 12 videos selected", and "Deselect All" button.
  Checklist of 6 rich mock item cards with individual checkboxes, custom thumbnails, titles, channel names, and durations.
  Sticky footer action bar with "Download 10 Selected Items (Estimated ~1.2 GB)".
  ```

### Screen 5: `05_clips_trimmer.html` (Precision Timeline Trimmer & Multi-Clip Builder)
- **Prompt**:
  ```markdown
  Design the Precision Timeline Trimmer and Multi-Clip Queue canvas for Offliner.
  16:9 video preview card with playhead at 01:42 and duration timestamps.
  Dual-handle interactive timeline scrubber track with shaded active cut segment between 00:35 and 02:15.
  Precision numerical time inputs: Start (00:00:35) and End (00:02:15) with +/- 1s micro-nudge buttons and duration pill (1m 40s).
  "Add Clip to Queue" secondary button.
  Queued cut segments list displaying:
  - Clip 1: "Intro Solo" (00:00:15 → 00:01:10 • 55s)
  - Clip 2: "Chorus Peak" (00:01:45 → 00:02:30 • 45s)
  Master CTA button "Download All Clips (2 Segments)".
  ```

### Screen 6: `06_queue_manager.html` (Concurrency-Bounded Queue & Progress Smoothing)
- **Prompt**:
  ```markdown
  Design the Download Queue Manager view for Offliner.
  Header toolbar with global actions: "Pause All", "Resume All", "Clear Finished", and concurrency meter "2 / 3 Active Slots".
  Collapsible Section 1: Active Downloads (2 items):
  - Item 1: "Cyberpunk 2077 - Path Tracing Demo (4K)", Progress 68.4%, animated progress bar, smoothed speed 14.8 MB/s, ETA 00:24, size 412 MB / 602 MB. Pause and Cancel buttons.
  - Item 2: "Synthesizer Masterclass - Sound Design", Progress 32.1%, speed 8.2 MB/s, ETA 01:12. Pause and Cancel buttons.
  Collapsible Section 2: Queued Items (1 item) with position badge and Cancel action.
  Collapsible Section 3: Completed Downloads (2 items) with "Open File", "Show Folder", and "Delete to Trash" actions.
  Collapsible Section 4: Failed / Error (1 item) with error details "HTTP 403: Private video" and Retry action.
  ```

### Screen 7: `07_settings.html` (Preferences, Concurrency Limiter & Theme Selector)
- **Prompt**:
  ```markdown
  Design the Application Settings & Preferences canvas for Offliner.
  General Preferences card:
  - Download folder path with "Browse" folder picker.
  - Concurrency slider (1 to 8 parallel downloads) with active badge "3 Simultaneous Downloads".
  Appearance Customizer card:
  - 3 interactive visual theme cards (Light Daylight, Dark Obsidian, Monochrome Noir) with live CSS preview.
  Advanced Media Engine card:
  - Embed subtitles toggle switch.
  - Keyframe-accurate cuts (--force-keyframes-at-cuts) toggle switch.
  - Custom yt-dlp CLI arguments input field.
  Application status card with version "v1.1.1", auto-update toggle, and "Check for Updates" button.
  ```
