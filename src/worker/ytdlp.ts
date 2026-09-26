// src/worker/ytdlp.ts
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { parseProgress, ProgressUpdate } from './progress-parser';
import type { VideoMetadata, ClipRange } from '../types';

export interface YtDlpOptions {
  url: string;
  format?: string;
  videoFormat?: string;
  outputPath?: string;
  audioFormat?: string;
  audioQuality?: number;
  clips?: ClipRange[];
  extractAudio?: boolean;
  isPlaylist?: boolean;
}

export class YtDlp {
  private ytdlpPath: string;
  private ffmpegPath: string | null = null;
  private jsRuntimes: string[] = [];
  private process: ChildProcess | null = null;

  constructor() {
    this.ytdlpPath = this.findYtDlp();
    this.ffmpegPath = this.findFfmpeg();
    this.jsRuntimes = this.findJsRuntimes();
  }

  private findYtDlp(): string {
    const resourcesPath = process.env.RESOURCES_PATH || (process as any).resourcesPath;
    const platform = process.platform;
    const binName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const platFolder = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
    
    // 1. Check in RESOURCES_PATH (passed from main)
    if (resourcesPath) {
      const prodPath = join(resourcesPath, 'yt-dlp', platFolder, binName);
      if (existsSync(prodPath)) return prodPath;
      const legacyPath = join(resourcesPath, 'yt-dlp', binName);
      if (existsSync(legacyPath)) return legacyPath;
    }

    // 2. Check build folder
    const devPlatPath = join(process.cwd(), 'build', 'yt-dlp', platFolder, binName);
    if (existsSync(devPlatPath)) return devPlatPath;

    const devPath = join(process.cwd(), 'build', 'yt-dlp', binName);
    if (existsSync(devPath)) return devPath;

    // 3. Last resort: system PATH
    return binName;
  }

  private findFfmpeg(): string | null {
    const resourcesPath = process.env.RESOURCES_PATH || (process as any).resourcesPath;
    const platform = process.platform;
    const binName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const platFolder = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';

    // 1. Check in RESOURCES_PATH
    if (resourcesPath) {
      const prodPath = join(resourcesPath, 'ffmpeg', platFolder, binName);
      if (existsSync(prodPath)) return prodPath;
      
      const legacyPath = join(resourcesPath, 'ffmpeg', binName);
      if (existsSync(legacyPath)) return legacyPath;
    }

    // 2. Check build folder
    const devPlatPath = join(process.cwd(), 'build', 'ffmpeg', platFolder, binName);
    if (existsSync(devPlatPath)) return devPlatPath;

    const devPath = join(process.cwd(), 'build', 'ffmpeg', binName);
    if (existsSync(devPath)) return devPath;

    // 3. Try system PATH
    try {
      const { execSync } = require('child_process');
      execSync(`${binName} -version`, { stdio: 'ignore' });
      return binName;
    } catch {
      return null;
    }
  }

  private findJsRuntimes(): string[] {
    const runtimes: string[] = [];
    const isWin = process.platform === 'win32';
    const resourcesPath = process.env.RESOURCES_PATH;
    const home = process.env.HOME || process.env.USERPROFILE || '';

    // 1. Check for Deno
    const denoName = isWin ? 'deno.exe' : 'deno';
    const possibleDenoPaths: string[] = [];

    if (this.ytdlpPath && this.ytdlpPath !== (isWin ? 'yt-dlp.exe' : 'yt-dlp')) {
      possibleDenoPaths.push(join(dirname(this.ytdlpPath), denoName));
    }
    if (resourcesPath) {
      possibleDenoPaths.push(join(resourcesPath, 'deno', denoName));
      possibleDenoPaths.push(join(resourcesPath, 'yt-dlp', denoName));
    }
    if (home) {
      possibleDenoPaths.push(join(home, '.deno', 'bin', denoName));
    }

    let foundDeno = false;
    for (const p of possibleDenoPaths) {
      if (existsSync(p)) {
        runtimes.push(`deno:${p}`);
        foundDeno = true;
        break;
      }
    }

    if (!foundDeno) {
      try {
        const { execSync } = require('child_process');
        execSync(`${denoName} --version`, { stdio: 'ignore' });
        runtimes.push('deno');
        foundDeno = true;
      } catch {
        // Not in PATH
      }
    }

    // 2. Check for Node.js
    const nodeName = isWin ? 'node.exe' : 'node';
    try {
      const { execSync } = require('child_process');
      execSync(`${nodeName} --version`, { stdio: 'ignore' });
      runtimes.push('node');
    } catch {
      // Not in PATH
    }

    // 3. Check for Bun
    const bunName = isWin ? 'bun.exe' : 'bun';
    let foundBun = false;
    if (home) {
      const bunPath = join(home, '.bun', 'bin', bunName);
      if (existsSync(bunPath)) {
        runtimes.push(`bun:${bunPath}`);
        foundBun = true;
      }
    }
    if (!foundBun) {
      try {
        const { execSync } = require('child_process');
        execSync(`${bunName} --version`, { stdio: 'ignore' });
        runtimes.push('bun');
      } catch {
        // Not in PATH
      }
    }

    // Default fallback: enable both deno and node so yt-dlp queries system PATH internally
    if (runtimes.length === 0) {
      runtimes.push('deno');
      runtimes.push('node');
    }

    return runtimes;
  }

  private getCommonExtractionArgs(): string[] {
    const args: string[] = [
      '--no-update',
      '--format-sort', 'proto',
    ];

    for (const rt of this.jsRuntimes) {
      args.push('--js-runtimes', rt);
    }

    args.push('--extractor-args', 'youtube:player_client=web_embedded,web');

    return args;
  }

  async fetchMetadata(url: string, options: { noPlaylist?: boolean; flatPlaylist?: boolean } = {}): Promise<VideoMetadata> {
    const args = [
      '--dump-single-json',
      '--no-download',
      '--no-warnings',
      ...this.getCommonExtractionArgs(),
    ];

    if (options.noPlaylist) {
      args.push('--no-playlist');
    }
    
    if (options.flatPlaylist || url.includes('list=') || url.includes('playlist?')) {
      args.push('--flat-playlist');
    }

    args.push(url);

    return new Promise((resolve, reject) => {
      const child = spawn(this.ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      child.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`yt-dlp metadata failed (exit ${code}): ${stderr}`));
          return;
        }
        try {
          const json = JSON.parse(stdout);
          resolve(this.parseMetadata(json));
        } catch (e) {
          reject(new Error(`Failed to parse yt-dlp JSON: ${e}`));
        }
      });
    });
  }

  private getBestThumbnail(json: any): string {
    if (json.thumbnail) return json.thumbnail;
    if (json.thumbnails && Array.isArray(json.thumbnails) && json.thumbnails.length > 0) {
      // Pick the last one which is usually highest res
      return json.thumbnails[json.thumbnails.length - 1].url || '';
    }
    return '';
  }

  private parseMetadata(json: Record<string, unknown>): VideoMetadata {
    const isPlaylist = json['_type'] === 'playlist' || Array.isArray(json['entries']);
    const rawFormats = ((json['formats'] as any[]) || []);

    // Filter out non-media storyboard formats (mhtml / storyboard)
    let formatsList = rawFormats.filter((f) => {
      if (f['protocol'] === 'mhtml' || f['ext'] === 'mhtml') return false;
      const note = String(f['format_note'] || '').toLowerCase();
      if (note.includes('storyboard')) return false;
      return true;
    });

    const isM3u8Format = (f: Record<string, unknown>) => {
      const proto = String(f['protocol'] || '').toLowerCase();
      const url = String(f['url'] || '').toLowerCase();
      const manifest = String(f['manifest_url'] || '').toLowerCase();
      return proto.includes('m3u8') || url.includes('.m3u8') || manifest.includes('.m3u8');
    };

    // If direct HTTPS/HTTP video or audio formats exist, filter out m3u8 (HLS) formats
    // to avoid selecting unseekable or throttled streams that freeze or stall clipping
    const hasDirectVideo = formatsList.some(
      (f) => f['vcodec'] && f['vcodec'] !== 'none' && !isM3u8Format(f)
    );
    const hasDirectAudio = formatsList.some(
      (f) => f['acodec'] && f['acodec'] !== 'none' && !isM3u8Format(f)
    );

    if (hasDirectVideo || hasDirectAudio) {
      formatsList = formatsList.filter((f) => {
        if (!isM3u8Format(f)) return true;
        const isVideo = f['vcodec'] && f['vcodec'] !== 'none';
        const isAudio = f['acodec'] && f['acodec'] !== 'none' && !isVideo;
        if (isVideo && hasDirectVideo) return false;
        if (isAudio && hasDirectAudio) return false;
        if (hasDirectVideo && hasDirectAudio) return false;
        return true;
      });
    }

    const formats = formatsList.map((f: Record<string, unknown>) => ({
      format_id: String(f['format_id'] || ''),
      ext: String(f['ext'] || 'unknown'),
      resolution: String(f['resolution'] || (f['vcodec'] !== 'none' ? 'unknown' : 'audio only')),
      filesize: f['filesize'] as number | undefined,
      vcodec: f['vcodec'] as string | undefined,
      acodec: f['acodec'] as string | undefined,
      abr: f['abr'] as number | undefined,
      vbr: f['vbr'] as number | undefined,
      fps: f['fps'] as number | undefined,
      note: f['format_note'] as string | undefined,
      protocol: f['protocol'] as string | undefined,
    }));

    const entries = isPlaylist ? (json['entries'] as any[]).map(e => ({
      id: String(e['id']),
      url: String(e['webpage_url'] || e['url'] || ''),
      title: String(e['title'] || 'Unknown'),
      thumbnail: this.getBestThumbnail(e),
      duration: Number(e['duration'] || 0),
      uploader: String(e['uploader'] || 'Unknown'),
      formats: [],
      is_playlist: false,
    })) as VideoMetadata[] : undefined;

    return {
      id: String(json['id'] || ''),
      url: String(json['webpage_url'] || ''),
      title: String(json['title'] || 'Unknown'),
      description: json['description'] as string | undefined,
      duration: Number(json['duration'] || 0),
      thumbnail: this.getBestThumbnail(json),
      uploader: String(json['uploader'] || 'Unknown'),
      upload_date: json['upload_date'] as string | undefined,
      view_count: json['view_count'] as number | undefined,
      formats,
      is_playlist: isPlaylist,
      entries,
    };
  }

  startDownload(options: YtDlpOptions, onProgress: (update: ProgressUpdate) => void): Promise<string> {
    const args = this.buildArgs(options);
    console.error(`[worker] Spawning yt-dlp: ${this.ytdlpPath} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      this.process = spawn(this.ytdlpPath, args, { 
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      });

      let finalPath = '';
      let errorOutput = '';
      let clipDuration: number | undefined;
      if (options.clips && options.clips.length > 0) {
        clipDuration = options.clips.reduce((acc, c) => acc + Math.max(1, (c.end || 0) - (c.start || 0)), 0);
      }

      let lineBuffer = '';
      let lastPercent = 0;

      const parseDestinationLine = (line: string) => {
        const trimmed = line.trim();
        if (trimmed.includes('[download] Destination:')) {
          const p = trimmed.split('[download] Destination:')[1].trim();
          if (p) finalPath = p;
        } else if (trimmed.includes('has already been downloaded')) {
          const parts = trimmed.split('has already been downloaded');
          if (parts[0].includes('[download]')) {
             const p = parts[0].split('[download]')[1].trim();
             if (p) finalPath = p;
          }
        } else if (trimmed.includes('[Merger] Merging formats into "')) {
          const p = trimmed.split('[Merger] Merging formats into "')[1].split('"')[0].trim();
          if (p) finalPath = p;
        } else if (trimmed.includes('[ExtractAudio] Destination:')) {
           const p = trimmed.split('[ExtractAudio] Destination:')[1].trim();
           if (p) finalPath = p;
        } else if (trimmed.includes('[VideoRemuxer] Remuxing video from "')) {
           const p = trimmed.split('to "')[1]?.split('"')[0]?.trim();
           if (p) finalPath = p;
        } else if (trimmed.includes('[MoveFiles] Moving file "')) {
           const p = trimmed.split('to "')[1]?.split('"')[0]?.trim();
           if (p) finalPath = p;
        }
      };

      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        
        const progress = parseProgress(text, clipDuration);
        if (progress) {
          if (progress.percent < lastPercent) {
            progress.percent = lastPercent;
          } else {
            lastPercent = progress.percent;
          }
          onProgress(progress);
        }

        lineBuffer += text;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';
        for (const line of lines) {
          parseDestinationLine(line);
        }
      };

      this.process.stdout!.on('data', handleOutput);
      this.process.stderr!.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        errorOutput += text;
        handleOutput(chunk);
      });

      this.process.on('close', (code) => {
        this.process = null;
        if (lineBuffer.trim().length > 0) {
          parseDestinationLine(lineBuffer);
        }
        if (code === 0 || code === null) {
          resolve(finalPath);
        } else {
          reject(new Error(errorOutput.trim() || `yt-dlp exited with code ${code}`));
        }
      });

      this.process.on('error', (err) => {
        this.process = null;
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
    });
  }

  private buildArgs(options: YtDlpOptions): string[] {
    const args: string[] = [];

    // Format selection
    if (options.extractAudio) {
      args.push('-x');
      if (options.audioFormat) args.push('--audio-format', options.audioFormat);
      if (options.audioQuality !== undefined) args.push('--audio-quality', String(options.audioQuality));
      if (options.clips && options.clips.length > 0) {
        // For audio clips, force seekable progressive format so FFmpeg does not soft-seek remote DASH audio
        args.push('-f', 'b[protocol!*=m3u8]/b/best[protocol!*=m3u8]/best');
      }
    } else if (options.clips && options.clips.length > 0) {
      // For clipping downloads, use progressive seekable formats (b[protocol!*=m3u8]/b/best[protocol!*=m3u8]/best)
      // which download sections instantaneously via HTTP range requests without remote soft-seeking stalls.
      let clipFormat = 'b[protocol!*=m3u8]/b/best[protocol!*=m3u8]/best';
      if (options.format) {
        if (options.format === '18' || options.format === '22') {
          clipFormat = `${options.format}[protocol!*=m3u8]/${clipFormat}`;
        } else if (options.format.startsWith('b[') || options.format.startsWith('best[')) {
          const guarded = options.format.includes('protocol!*=m3u8')
            ? options.format
            : options.format.replace(/\]$/, '][protocol!*=m3u8]');
          clipFormat = `${guarded}/${clipFormat}`;
        }
      }
      args.push('-f', clipFormat);
    } else if (options.format) {
      let format = options.format;
      if (!options.extractAudio && !format.includes('+') && !format.includes('[') && format !== 'best') {
        format = `${format}+bestaudio[protocol!*=m3u8]/bestaudio/best`;
      } else if (!options.extractAudio && format.includes('+') && !format.includes('[protocol!*=m3u8]')) {
        format = format.replace(/\+bestaudio(\/best)?\b/, '+bestaudio[protocol!*=m3u8]/bestaudio/best');
      }
      args.push('-f', format);
    }

    // Clip support - use download-sections with forced keyframes to prevent frozen video
    if (options.clips && options.clips.length > 0) {
      for (const clip of options.clips) {
        const start = Math.max(0, clip.start);
        const end = Math.max(start + 1, clip.end);
        args.push('--download-sections', `*${start}-${end}`);
      }
      // Force keyframes at cuts so video stream starts cleanly with no frozen frames
      args.push('--force-keyframes-at-cuts');
    }

    // Output path
    if (options.outputPath) {
      let outputTemplate = '%(title)s.%(ext)s';
      if (options.clips && options.clips.length > 0) {
        outputTemplate = '%(title)s - %(section_start)s-%(section_end)s.%(ext)s';
      }
      args.push('--output', join(options.outputPath, outputTemplate));
    }

    // Container format - merge & remux to MP4 by default for video/clip downloads
    if (!options.extractAudio) {
      const container = options.videoFormat || 'mp4';
      args.push('--merge-output-format', container);
      args.push('--remux-video', container);
    }

    // Common flags
    args.push('--newline', '--no-overwrites', '--restrict-filenames');
    args.push('--no-check-certificates');
    args.push(...this.getCommonExtractionArgs());
    
    // Fix echo issues by preventing multiple audio streams from being mixed incorrectly
    // or by forcing a single audio stream if possible.
    if (options.extractAudio) {
      args.push('--audio-multistreams'); // Allow multiple streams but we specify format above
    } else {
      args.push('--no-audio-multistreams');
    }

    if (this.ffmpegPath) {
      args.push('--ffmpeg-location', this.ffmpegPath);
    }

    if (options.isPlaylist) {
      args.push('--yes-playlist');
    }

    // URL (always last)
    args.push(options.url);

    return args;
  }

  async updateYtDlp(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const child = spawn(this.ytdlpPath, ['-U'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';

      child.stdout?.on('data', (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr?.on('data', (chunk: Buffer) => { output += chunk.toString(); });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          message: output.trim() || `yt-dlp update exited with code ${code}`,
        });
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          message: `Failed to execute yt-dlp update: ${err.message}`,
        });
      });
    });
  }

  kill(): void {
    if (this.process) {
      if (process.platform === 'win32' && this.process.pid) {
        const { spawn } = require('child_process');
        spawn('taskkill', ['/pid', this.process.pid.toString(), '/f', '/t']);
      } else if (this.process.pid) {
        try {
          process.kill(-this.process.pid, 'SIGKILL');
        } catch (e) {
          this.process.kill('SIGKILL');
        }
      }
      this.process = null;
    }
  }
}
