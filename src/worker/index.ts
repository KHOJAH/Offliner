// src/worker/index.ts
import { YtDlp, YtDlpOptions } from './ytdlp';
import type { CommandMessage, EventMessage } from '../types';
import { DownloadQueue } from './queue';

const ytdlp = new YtDlp();
const queue = new DownloadQueue({
  concurrency: 3,
  onProgress: (downloadId, update) => {
    sendEvent({
      type: 'event',
      action: 'progress',
      downloadId,
      percent: update.percent,
      speed: update.speed || undefined,
      speedBps: update.speedBps || undefined,
      eta: update.eta || undefined,
      etaSeconds: update.etaSeconds || undefined,
      totalBytes: update.totalBytes || undefined,
      downloadedBytes: update.downloadedBytes || undefined,
    });
  },
  onDone: (downloadId, filePath) => {
    sendEvent({ type: 'event', action: 'done', downloadId, filePath });
  },
  onError: (downloadId, message) => {
    sendEvent({ type: 'event', action: 'error', downloadId, message });
  },
});

function sendEvent(event: EventMessage): void {
  process.stdout.write(JSON.stringify(event) + '\n');
}

// Read commands from stdin
process.stdin.setEncoding('utf8');
let stdinBuffer = '';
process.stdin.on('data', (chunk: string) => {
  stdinBuffer += chunk;
  let lineEndIndex;
  while ((lineEndIndex = stdinBuffer.indexOf('\n')) !== -1) {
    const line = stdinBuffer.slice(0, lineEndIndex).trim();
    stdinBuffer = stdinBuffer.slice(lineEndIndex + 1);
    if (!line) continue;
    try {
      const cmd: CommandMessage = JSON.parse(line);
      console.error(`[worker] Received command: ${cmd.action} (ID: ${cmd.id})`);
      handleCommand(cmd).catch((err) => {
        console.error(`[worker] Command ${cmd.action} failed:`, err);
        sendEvent({
          type: 'event',
          action: 'error',
          downloadId: cmd.id,
          message: err.message,
        });
      });
    } catch (e) {
      console.error(`[worker] Failed to parse command:`, e, 'Line:', line.slice(0, 100));
      sendEvent({
        type: 'event',
        action: 'error',
        message: `Invalid command: ${(e as Error).message}`,
      });
    }
  }
});

async function handleCommand(cmd: CommandMessage): Promise<void> {
  switch (cmd.action) {
    case 'metadata': {
      const url = (cmd.args as any).url as string;
      const metadata = await ytdlp.fetchMetadata(url);
      sendEvent({ type: 'event', action: 'metadata', downloadId: cmd.id, data: metadata as any });
      break;
    }
    case 'download': {
      const config = cmd.args as any;
      const opts: YtDlpOptions = {
        url: config.url,
        format: config.format,
        outputPath: config.outputPath,
        audioFormat: config.audioFormat,
        audioQuality: config.audioQuality,
        clips: config.clips,
        extractAudio: !!config.audioFormat,
        isPlaylist: config.isPlaylist,
      };
      await queue.addDownload(cmd.id, opts, config.url);
      break;
    }
    case 'cancel': {
      const downloadId = (cmd.args as any).downloadId as string;
      queue.cancel(downloadId);
      break;
    }
    case 'pause': {
      const downloadId = (cmd.args as any).downloadId as string;
      queue.pause(downloadId);
      break;
    }
    case 'resume': {
      const args = cmd.args as any;
      const downloadId = args.downloadId as string;
      queue.resume(downloadId, args.opts, args.url);
      break;
    }
    default:
      sendEvent({ type: 'event', action: 'error', message: `Unknown action: ${(cmd as any).action}` });
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  queue.cancelAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  queue.cancelAll();
  process.exit(0);
});
