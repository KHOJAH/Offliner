/**
 * src/engine/parser/destination.ts
 * Robust destination file path extractor and tracker for yt-dlp post-processors and mergers.
 */

import { stripAnsi } from './progress';
import type { DestinationInfo } from './types';

function cleanPath(raw: string): string {
  return raw.replace(/^["']|["']$/g, '').trim();
}

/**
 * Parses a single stdout line for destination file indications.
 */
export function parseDestinationLine(line: string): DestinationInfo | null {
  const clean = stripAnsi(line).trim();
  if (!clean) return null;

  // 1. Merger final container output (takes highest precedence)
  const mergerMatch = clean.match(/\[Merger\]\s+Merging formats into\s+"([^"]+)"/i);
  if (mergerMatch && mergerMatch[1]) {
    return {
      filePath: cleanPath(mergerMatch[1]),
      operation: 'merge',
      isFinal: true,
    };
  }

  // 2. Audio extraction final destination
  const audioMatch = clean.match(/\[ExtractAudio\]\s+Destination:\s+(.+)$/i);
  if (audioMatch && audioMatch[1]) {
    return {
      filePath: cleanPath(audioMatch[1]),
      operation: 'extract_audio',
      isFinal: true,
    };
  }

  // 3. Video remuxer output
  const remuxMatch = clean.match(/\[VideoRemuxer\]\s+Remuxing video from\s+".*?"\s+to\s+"([^"]+)"/i);
  if (remuxMatch && remuxMatch[1]) {
    return {
      filePath: cleanPath(remuxMatch[1]),
      operation: 'remux',
      isFinal: true,
    };
  }

  // 4. Moving file to final destination
  const moveMatch = clean.match(/\[MoveFiles\]\s+Moving file\s+".*?"\s+to\s+"([^"]+)"/i);
  if (moveMatch && moveMatch[1]) {
    return {
      filePath: cleanPath(moveMatch[1]),
      operation: 'move',
      isFinal: true,
    };
  }

  // 5. Fixup M4A container
  const fixupMatch = clean.match(/\[FixupM4a\]\s+Correcting container in\s+"([^"]+)"/i);
  if (fixupMatch && fixupMatch[1]) {
    return {
      filePath: cleanPath(fixupMatch[1]),
      operation: 'fixup',
      isFinal: true,
    };
  }

  // 6. Standard stream download destination (must precede already-downloaded check)
  const dlMatch = clean.match(/\[download\]\s+Destination:\s+(.+)$/i);
  if (dlMatch && dlMatch[1]) {
    return {
      filePath: cleanPath(dlMatch[1]),
      operation: 'download',
      isFinal: false,
    };
  }

  // 7. Already downloaded destination (ensuring active Destination: lines do not match)
  const alreadyMatch = clean.match(
    /^\[download\]\s+(?!Destination:\s+)(.+?)\s+has already been downloaded(?:\s+and recorded in the archive)?$/i
  );
  if (alreadyMatch && alreadyMatch[1]) {
    return {
      filePath: cleanPath(alreadyMatch[1]),
      operation: 'already_downloaded',
      isFinal: true,
    };
  }

  return null;
}

/**
 * Extracts latest or final destination path from a text chunk.
 */
export function extractDestinationPath(chunk: string, currentPath?: string): string | null {
  if (!chunk) return currentPath || null;
  const lines = chunk.split(/[\r\n]+/);
  let resolved = currentPath || null;
  let isResolvedFinal = false;

  for (const line of lines) {
    const info = parseDestinationLine(line);
    if (info) {
      if (info.isFinal) {
        resolved = info.filePath;
        isResolvedFinal = true;
      } else if (!isResolvedFinal) {
        resolved = info.filePath;
      }
    }
  }

  return resolved;
}

/**
 * Stateful tracker that monitors streaming output chunks and holds the latest valid destination path.
 */
export class DestinationTracker {
  private currentPath: string | null = null;
  private isFinal = false;

  public update(chunk: string): string | null {
    if (!chunk) return this.currentPath;
    const lines = chunk.split(/[\r\n]+/);
    for (const line of lines) {
      const info = parseDestinationLine(line);
      if (info) {
        if (info.isFinal) {
          this.currentPath = info.filePath;
          this.isFinal = true;
        } else if (!this.isFinal) {
          this.currentPath = info.filePath;
        }
      }
    }
    return this.currentPath;
  }

  public getPath(): string | null {
    return this.currentPath;
  }

  public reset(): void {
    this.currentPath = null;
    this.isFinal = false;
  }
}
