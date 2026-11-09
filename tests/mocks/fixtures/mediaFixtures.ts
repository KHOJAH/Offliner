/**
 * tests/mocks/fixtures/mediaFixtures.ts
 * Deterministic pre-recorded mock fixtures for yt-dlp metadata and stream outputs.
 */

import type { VideoMetadata } from '@/types';

export const MOCK_SINGLE_VIDEO_METADATA: VideoMetadata = {
  id: 'vid-4k-sample',
  url: 'https://youtube.com/watch?v=vid-4k-sample',
  title: 'Big Buck Bunny 4K 60fps HDR Master',
  duration: 360,
  thumbnail: 'https://i.ytimg.com/vi/vid-4k-sample/maxresdefault.jpg',
  uploader: 'Blender Foundation',
  upload_date: '20250101',
  view_count: 1500000,
  is_playlist: false,
  formats: [
    { format_id: '313', resolution: '3840x2160', fps: 60, vcodec: 'vp9', vbr: 18000, ext: 'webm', note: '4K 60fps' },
    { format_id: '137', resolution: '1920x1080', fps: 30, vcodec: 'avc1.640028', vbr: 4500, ext: 'mp4', note: '1080p Full HD' },
    { format_id: '22', resolution: '1280x720', fps: 30, vcodec: 'avc1.64001f', acodec: 'mp4a.40.2', abr: 192, ext: 'mp4', note: '720p HD Muxed' },
    { format_id: '18', resolution: '640x360', fps: 30, vcodec: 'avc1.42001e', acodec: 'mp4a.40.2', abr: 96, ext: 'mp4', note: '360p SD' },
    { format_id: '140', resolution: 'audio only', acodec: 'mp4a.40.2', abr: 128, ext: 'm4a', note: 'AAC Medium' },
    { format_id: '251', resolution: 'audio only', acodec: 'opus', abr: 160, ext: 'webm', note: 'Opus High' },
  ],
};

export const MOCK_PLAYLIST_METADATA: VideoMetadata = {
  id: 'pl-chillstep-album',
  url: 'https://youtube.com/playlist?list=pl-chillstep-album',
  title: 'Chillstep Studio Master Album 2026',
  duration: 1200,
  thumbnail: 'https://i.ytimg.com/vi/track-01/hqdefault.jpg',
  uploader: 'Audio Studio Records',
  is_playlist: true,
  formats: [],
  entries: [
    { id: 'track-01', url: 'https://youtube.com/watch?v=track-01', title: '01. Horizon Dreams', duration: 240, uploader: 'Audio Studio', thumbnail: 'https://i.ytimg.com/vi/track-01/hqdefault.jpg', formats: [], is_playlist: false },
    { id: 'track-02', url: 'https://youtube.com/watch?v=track-02', title: '02. Neon Twilight', duration: 180, uploader: 'Audio Studio', thumbnail: 'https://i.ytimg.com/vi/track-02/hqdefault.jpg', formats: [], is_playlist: false },
    { id: 'track-03', url: 'https://youtube.com/watch?v=track-03', title: '03. Deep Echoes', duration: 300, uploader: 'Audio Studio', thumbnail: 'https://i.ytimg.com/vi/track-03/hqdefault.jpg', formats: [], is_playlist: false },
    { id: 'track-04', url: 'https://youtube.com/watch?v=track-04', title: '04. Velvet Midnight', duration: 210, uploader: 'Audio Studio', thumbnail: 'https://i.ytimg.com/vi/track-04/hqdefault.jpg', formats: [], is_playlist: false },
    { id: 'track-05', url: 'https://youtube.com/watch?v=track-05', title: '05. Aurora Borealis', duration: 270, uploader: 'Audio Studio', thumbnail: 'https://i.ytimg.com/vi/track-05/hqdefault.jpg', formats: [], is_playlist: false },
  ],
};

export const MOCK_STREAM_CHUNKS = {
  videoDownload: (destination: string) => [
    `[download] Destination: ${destination}\n`,
    `[download]  25.0% of ~ 40.00MiB at  5.00MiB/s ETA 00:06\n`,
    `[download]  50.0% of ~ 40.00MiB at  6.20MiB/s ETA 00:03\n`,
    `[download]  75.0% of ~ 40.00MiB at  6.50MiB/s ETA 00:01\n`,
    `[download] 100% of  40.00MiB in 00:04\n`,
    `[Merger] Merging formats into "${destination}"\n`,
  ],
  audioExtract: (destination: string) => [
    `[download] Destination: ${destination}.temp\n`,
    `[download] 100% of 12.50MiB in 00:02\n`,
    `[ExtractAudio] Destination: ${destination}\n`,
    `Deleting original file ${destination}.temp (pass -k to keep)\n`,
  ],
  clipCut: (destination: string, start: number, end: number) => [
    `[download] Destination: ${destination}\n`,
    `[download] Downloading section from ${start} to ${end}\n`,
    `[download] 100% of 5.20MiB in 00:01\n`,
  ],
  errorUnavailable: [
    `ERROR: [youtube] vid-4k-sample: Video unavailable. This video is not available in your region\n`,
  ],
  errorPrivate: [
    `ERROR: [youtube] Private video. Sign in if you've been granted access to this video\n`,
  ],
};
