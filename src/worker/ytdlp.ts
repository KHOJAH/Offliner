// src/worker/ytdlp.ts
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { parseProgress, ProgressUpdate } from './progress-parser';
import type { VideoMetadata, ClipRange } from '../types';

export interface YtDlpOptions {
  url: string;
  format?: string;
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
  private process: ChildProcess | null = null;

  constructor() {
    this.ytdlpPath = this.findYtDlp();
    this.ffmpegPath = this.findFfmpeg();
  }

  private findYtDlp(): string {
    const isDev = process.env.NODE_ENV === 'development';
    const resourcesPath = process.env.RESOURCES_PATH;
    const platform = process.platform;
    const binName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const platFolder = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
    
    // 1. Check in RESOURCES_PATH (passed from main)
    if (resourcesPath) {
      const prodPath = join(resourcesPath, 'yt-dlp', platFolder, binName);
      if (existsSync(prodPath)) return prodPath;
    }

    // 2. Fallback for Dev if RESOURCES_PATH failed
    if (isDev) {
      const devPath = join(process.cwd(), 'build', 'yt-dlp', platFolder, binName);
      if (existsSync(devPath)) return devPath;
    }

    // 3. Last resort: system PATH
    return binName;
  }

  private findFfmpeg(): string | null {
    const isDev = process.env.NODE_ENV === 'development';
    const resourcesPath = process.env.RESOURCES_PATH;
    const platform = process.platform;
    const binName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

    // 1. Check in RESOURCES_PATH
    if (resourcesPath) {
      // Try platform-specific subfolder first
      const platFolder = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
      let prodPath = join(resourcesPath, 'ffmpeg', platFolder, binName);
      if (existsSync(prodPath)) return prodPath;
      
      // Fallback to legacy structure (ffmpeg/ffmpeg.exe)
      prodPath = join(resourcesPath, 'ffmpeg', binName);
      if (existsSync(prodPath)) return prodPath;
    }

    // 2. Fallback for Dev
    if (isDev) {
      const platFolder = platform === 'win32' ? 'win32' : platform === 'darwin' ? 'darwin' : 'linux';
      let devPath = join(process.cwd(), 'build', 'ffmpeg', platFolder, binName);
      if (existsSync(devPath)) return devPath;

      devPath = join(process.cwd(), 'build', 'ffmpeg', binName);
      if (existsSync(devPath)) return devPath;
    }

    // 3. Try system PATH
    try {
      const { execSync } = require('child_process');
      execSync(`${binName} -version`, { stdio: 'ignore' });
      return binName;
    } catch {
      return null;
    }
  }

  async fetchMetadata(url: string, options: { noPlaylist?: boolean; flatPlaylist?: boolean } = {}): Promise<VideoMetadata> {
    const args = [
      '--dump-single-json',
      '--no-download',
      '--no-warnings',
      url,
    ];

    if (options.noPlaylist) {
      args.push('--no-playlist');
    }
    
    if (options.flatPlaylist || url.includes('list=') || url.includes('playlist?')) {
      args.push('--flat-playlist');
    }

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
    const formats = ((json['formats'] as any[]) || []).map((f: Record<string, unknown>) => ({
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

      const handleOutput = (data: Buffer) => {
        const text = data.toString();
        
        const progress = parseProgress(text);
        if (progress) {
          onProgress(progress);
        }

        const lines = text.split('\n');
        for (const line of lines) {
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
            // Also capture merged file path
            const p = trimmed.split('[Merger] Merging formats into "')[1].split('"')[0].trim();
            if (p) finalPath = p;
          } else if (trimmed.includes('[ExtractAudio] Destination:')) {
             const p = trimmed.split('[ExtractAudio] Destination:')[1].trim();
             if (p) finalPath = p;
          }
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
    } else if (options.format) {
      let format = options.format;
      if (!options.extractAudio && !format.includes('+') && !format.includes('[') && format !== 'best') {
        format = `${format}+bestaudio/best`;
      }
      args.push('-f', format);
    }

    // Clip support - using --external-downloader ffmpeg and seeking for better compatibility
    if (options.clips && options.clips.length > 0) {
      if (options.clips.length === 1) {
        const clip = options.clips[0];
        // Use ffmpeg for seeking
        args.push('--external-downloader', 'ffmpeg');
        args.push('--external-downloader-args', `ffmpeg:-ss ${clip.start} -to ${clip.end}`);
      } else {
        // For multiple clips, we still use download-sections
        for (const clip of options.clips) {
          const sectionArg = `${clip.name || 'clip'}:*${clip.start}-${clip.end}`;
          args.push('--download-sections', sectionArg);
        }
      }
    }

    // Output path
    if (options.outputPath) {
      let outputTemplate = '%(title)s.%(ext)s';
      if (options.clips && options.clips.length > 0) {
        outputTemplate = '%(title)s - %(section_title,clip)s.%(ext)s';
      }
      args.push('--output', join(options.outputPath, outputTemplate));
    }

    // Common flags
    args.push('--newline', '--no-overwrites', '--restrict-filenames');
    args.push('--no-check-certificates', '--prefer-free-formats');
    
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
