/**
 * src/engine/ytdlp/resolver.ts
 * Metadata resolution, URL routing, and format normalization with injected IProcessRunner.
 */

import type { IProcessRunner } from '../runner/types';
import { getProcessRunner } from '../runner';
import type { VideoMetadata } from '../../types';
import { buildMetadataArgs, BinaryContext, MetadataOptions } from './builder';

export interface ResolverOptions {
  ytdlpPath?: string;
  context?: BinaryContext;
}

export interface IYtDlpResolver {
  fetchMetadata(url: string, options?: MetadataOptions): Promise<VideoMetadata>;
  detectUrlType(url: string): 'playlist' | 'video' | 'unknown';
}

export function getBestThumbnail(json: any): string {
  if (!json) return '';
  if (json.thumbnail) return String(json.thumbnail);
  if (json.thumbnails && Array.isArray(json.thumbnails) && json.thumbnails.length > 0) {
    // Pick the last one which is usually highest res
    return String(json.thumbnails[json.thumbnails.length - 1].url || '');
  }
  return '';
}

export function detectUrlType(url: string): 'playlist' | 'video' | 'unknown' {
  if (!url || typeof url !== 'string') return 'unknown';
  if (url.includes('list=') || url.includes('playlist?') || url.includes('/playlist')) {
    return 'playlist';
  }
  if (
    url.includes('watch?v=') ||
    url.includes('youtu.be/') ||
    url.includes('youtube.com/shorts/') ||
    url.includes('vimeo.com/') ||
    url.includes('twitch.tv/') ||
    url.includes('soundcloud.com/')
  ) {
    return 'video';
  }
  return 'unknown';
}

export function parseMetadata(json: Record<string, unknown>): VideoMetadata {
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

  const formats = formatsList.map((f: Record<string, unknown>) => {
    let res = f['resolution'] as string | undefined;
    if (!res && f['vcodec'] && f['vcodec'] !== 'none') {
      if (f['width'] && f['height']) {
        res = `${f['width']}x${f['height']}`;
      } else if (f['height']) {
        res = `${f['height']}p`;
      }
    }
    return {
      format_id: String(f['format_id'] || ''),
      ext: String(f['ext'] || 'unknown'),
      resolution: String(res || (f['vcodec'] !== 'none' ? 'unknown' : 'audio only')),
      filesize: f['filesize'] as number | undefined,
      vcodec: f['vcodec'] as string | undefined,
      acodec: f['acodec'] as string | undefined,
      abr: f['abr'] as number | undefined,
      vbr: f['vbr'] as number | undefined,
      fps: f['fps'] as number | undefined,
      note: f['format_note'] as string | undefined,
      protocol: f['protocol'] as string | undefined,
    };
  });

  const entries = isPlaylist
    ? ((json['entries'] as any[]) || []).map((e) => ({
        id: String(e['id']),
        url: String(e['webpage_url'] || e['url'] || ''),
        title: String(e['title'] || 'Unknown'),
        thumbnail: getBestThumbnail(e),
        duration: Number(e['duration'] || 0),
        uploader: String(e['uploader'] || 'Unknown'),
        formats: [],
        is_playlist: false,
      })) as VideoMetadata[]
    : undefined;

  return {
    id: String(json['id'] || ''),
    url: String(json['webpage_url'] || ''),
    title: String(json['title'] || 'Unknown'),
    description: json['description'] as string | undefined,
    duration: Number(json['duration'] || 0),
    thumbnail: getBestThumbnail(json),
    uploader: String(json['uploader'] || 'Unknown'),
    upload_date: json['upload_date'] as string | undefined,
    view_count: json['view_count'] as number | undefined,
    formats,
    is_playlist: isPlaylist,
    entries,
  };
}

export class YtDlpResolver implements IYtDlpResolver {
  private runner: IProcessRunner;
  private options: ResolverOptions;

  constructor(runner?: IProcessRunner, options: ResolverOptions = {}) {
    this.runner = runner || getProcessRunner();
    this.options = options;
  }

  async fetchMetadata(url: string, options: MetadataOptions = {}): Promise<VideoMetadata> {
    const ytdlpPath = this.options.ytdlpPath || 'yt-dlp';
    const args = buildMetadataArgs(url, options, this.options.context);

    const result = await this.runner.exec(ytdlpPath, args);

    if (result.exitCode !== 0) {
      throw new Error(`yt-dlp metadata failed (exit ${result.exitCode}): ${result.stderr}`);
    }

    try {
      const json = JSON.parse(result.stdout);
      return parseMetadata(json);
    } catch (e) {
      throw new Error(`Failed to parse yt-dlp JSON: ${(e as Error).message}`);
    }
  }

  detectUrlType(url: string): 'playlist' | 'video' | 'unknown' {
    return detectUrlType(url);
  }
}
