// src/worker/ytdlp.ts
import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { parseProgress, ProgressUpdate } from './progress-parser';
import type { VideoMetadata, ClipRange } from '../types';
import {
  buildDownloadArgs,
  buildMetadataArgs,
  parseMetadata,
  getBestThumbnail,
} from '../engine/ytdlp';

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
    return getBestThumbnail(json);
  }

  private parseMetadata(json: Record<string, unknown>): VideoMetadata {
    return parseMetadata(json);
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
    return buildDownloadArgs(options, {
      ffmpegPath: this.ffmpegPath,
      jsRuntimes: this.jsRuntimes,
    });
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
