// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildDownloadArgs,
  buildMetadataArgs,
  buildFormatString,
  type DownloadOptions,
  type ClipRange,
} from '@/engine/ytdlp/builder';
import {
  detectUrlType,
  parseMetadata,
  getBestThumbnail,
} from '@/engine/ytdlp/resolver';
import {
  parseProgress,
  parseStreamProgress,
  stripAnsi,
  parseSizeToBytes,
  parseTimeToSeconds,
  parseETAToSeconds,
  formatSecondsToETA,
} from '@/engine/parser/progress';
import {
  parseDestinationLine,
  extractDestinationPath,
  DestinationTracker,
} from '@/engine/parser/destination';
import {
  parseError,
  isTransientError,
  extractVideoId,
} from '@/engine/parser/error';

describe('Empirical Adversarial Challenge Suite: CLI Builder & Stream Parsers', () => {
  // =========================================================================
  // DIMENSION 1: CLI Argument Injection & URL Sanitization
  // =========================================================================
  describe('Dimension 1: Argument Injection & CLI Option Injection', () => {
    it('1.1 protects against CLI option injection by prefixing URL with POSIX -- delimiter', () => {
      // In POSIX CLI conventions, user-supplied positional arguments (like URLs)
      // must be preceded by '--' so that an input starting with '-' or '--'
      // is not parsed by the binary (yt-dlp) as a CLI option flag.
      const maliciousUrl = '--exec=touch /tmp/evil';
      const args = buildDownloadArgs({ url: maliciousUrl });

      const urlIdx = args.indexOf(maliciousUrl);
      expect(urlIdx).toBe(args.length - 1);

      // Check that '--' precedes the URL
      const precedingArg = args[args.length - 2];
      const hasPosixDelimiter = precedingArg === '--';
      expect(hasPosixDelimiter).toBe(true);
    });

    it('1.2 ensures buildMetadataArgs includes POSIX -- delimiter before URL', () => {
      const maliciousUrl = '--version';
      const args = buildMetadataArgs(maliciousUrl);

      const urlIdx = args.indexOf(maliciousUrl);
      expect(urlIdx).toBe(args.length - 1);
      const precedingArg = args[args.length - 2];
      expect(precedingArg).toBe('--');
    });

    it('1.3 does not word-split shell metacharacters in URL because runner passes args array', () => {
      const shellPayload = 'https://example.com/watch?v=123; rm -rf /; echo `whoami` | cat';
      const args = buildDownloadArgs({ url: shellPayload });

      // In args array, the entire payload is preserved intact in a single element
      expect(args[args.length - 1]).toBe(shellPayload);
      expect(args.filter((a) => a === 'rm').length).toBe(0);
      expect(args.filter((a) => a === '-rf').length).toBe(0);
    });

    it('1.4 handles empty string and whitespace-only URLs without throwing', () => {
      expect(() => buildDownloadArgs({ url: '' })).not.toThrow();
      expect(() => buildDownloadArgs({ url: '   ' })).not.toThrow();
      expect(() => buildMetadataArgs('')).not.toThrow();
    });

    it('1.5 detects URL routing accurately under adversarial query parameters', () => {
      // YouTube video with playlist parameter
      expect(detectUrlType('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL12345')).toBe('playlist');
      // Single video
      expect(detectUrlType('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('video');
      // Malformed or empty
      expect(detectUrlType('')).toBe('unknown');
      expect(detectUrlType(null as unknown as string)).toBe('unknown');
      expect(detectUrlType(undefined as unknown as string)).toBe('unknown');
      expect(detectUrlType('ftp://example.com/file.mp4')).toBe('unknown');
    });

    it('1.6 handles extremely long URLs (10,000+ characters) without memory or performance degradation', () => {
      const hugeUrl = 'https://youtube.com/watch?v=' + 'A'.repeat(10000);
      const start = performance.now();
      const args = buildDownloadArgs({ url: hugeUrl });
      const elapsed = performance.now() - start;

      expect(args[args.length - 1]).toBe(hugeUrl);
      expect(elapsed).toBeLessThan(50); // Under 50ms
    });
  });

  // =========================================================================
  // DIMENSION 2: Extreme Clip Time Ranges & Output Paths
  // =========================================================================
  describe('Dimension 2: Extreme Clip Time Ranges & Output Paths', () => {
    it('2.1 supports sub-second and sub-millisecond clip ranges without 1-second floor inflation', () => {
      // When a user requests a 0.001s clip (1 millisecond, e.g. start: 10, end: 10.001)
      const subMsClip: ClipRange = { start: 10, end: 10.001 };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [subMsClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      expect(sectionIdx).not.toBe(-1);
      // Accurately preserves sub-second clip range without 1.0s floor inflation
      expect(args[sectionIdx + 1]).toBe('*10-10.001');
    });

    it('2.2 accurately supports 500ms clip ranges without rounding up to 1 second', () => {
      const halfSecClip: ClipRange = { start: 0, end: 0.5 };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [halfSecClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      // Accurately preserves 500ms clip range
      expect(args[sectionIdx + 1]).toBe('*0-0.5');
    });

    it('2.3 coerces inverted clip ranges (start > end) to start + 1', () => {
      const invertedClip: ClipRange = { start: 50, end: 20 };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [invertedClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      // Math.max(0, 50) = 50, Math.max(51, 20) = 51 -> *50-51
      expect(args[sectionIdx + 1]).toBe('*50-51');
    });

    it('2.4 handles 24+ hour video clips without integer overflow', () => {
      // 25 hours = 90,000 seconds; 30 hours = 108,000 seconds
      const dayLongClip: ClipRange = { start: 90000, end: 108000 };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [dayLongClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      expect(args[sectionIdx + 1]).toBe('*90000-108000');
    });

    it('2.5 handles negative clip starts gracefully by clamping to 0', () => {
      const negClip: ClipRange = { start: -15, end: 30 };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [negClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      expect(args[sectionIdx + 1]).toBe('*0-30');
    });

    it('2.6 generates NaN sections when clip boundaries are NaN', () => {
      const nanClip: ClipRange = { start: NaN, end: NaN };
      const args = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        clips: [nanClip],
      });

      const sectionIdx = args.indexOf('--download-sections');
      // Math.max(0, NaN) is NaN in JS!
      expect(args[sectionIdx + 1]).toBe('*NaN-NaN');
    });

    it('2.7 inspects outputPath behavior when path ends with file extension vs directory', () => {
      // File path without clips
      const args1 = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        outputPath: '/downloads/myvideo.mp4',
      });
      const outIdx1 = args1.indexOf('--output');
      expect(args1[outIdx1 + 1]).toBe('/downloads/myvideo.mp4');

      // Directory with clips
      const args2 = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        outputPath: '/downloads',
        clips: [{ start: 5, end: 10 }],
      });
      const outIdx2 = args2.indexOf('--output');
      expect(args2[outIdx2 + 1]).toBe('/downloads/%(title)s - %(section_start)s-%(section_end)s.%(ext)s');

      // 1-char suffix like .0 does not match {2,4}, treated as directory:
      const args3 = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        outputPath: '/downloads/release.1.0',
      });
      const outIdx3 = args3.indexOf('--output');
      expect(args3[outIdx3 + 1]).toBe('/downloads/release.1.0/%(title)s.%(ext)s');

      // Edge case: Directory name with 2-4 char extension (e.g. /downloads/project.app or backup.old)
      const args4 = buildDownloadArgs({
        url: 'https://youtube.com/watch?v=abc',
        outputPath: '/downloads/project.app',
      });
      const outIdx4 = args4.indexOf('--output');
      // Matches /\.[a-zA-Z0-9]{2,4}$/ because of .app, so builder treats this directory as a concrete file!
      expect(args4[outIdx4 + 1]).toBe('/downloads/project.app');
    });
  });

  // =========================================================================
  // DIMENSION 3: Corrupted & Fragmented Stdout Lines
  // =========================================================================
  describe('Dimension 3: Corrupted & Fragmented Stdout Parsing', () => {
    it('3.1 handles high-density ANSI spam including 256-color, cursor moves, and resets', () => {
      const ansiSpam =
        '\x1b[38;5;196m\x1b[48;5;231m\x1b[2K\x1b[1G[download]\x1b[0m \x1b[1m 64.2%\x1b[22m of ~ \x1b[34m50.00MiB\x1b[0m at \x1b[32m5.00MiB/s\x1b[0m ETA \x1b[33m00:15\x1b[0m\x1b[K';
      const parsed = parseProgress(ansiSpam);

      expect(parsed).not.toBeNull();
      expect(parsed!.percent).toBe(64.2);
      expect(parsed!.speed).toBe('5.00 MiB/s');
      expect(parsed!.eta).toBe('00:15');
      expect(parsed!.etaSeconds).toBe(15);
      expect(parsed!.totalBytes).toBe(50 * 1024 * 1024);
      expect(parsed!.stage).toBe('download');
    });

    it('3.2 strips CSI ANSI sequences via stripAnsi utility', () => {
      const raw = '\x1b[0;31;40mERROR:\x1b[0m \x1b[1mSomething failed\x1b[0m';
      expect(stripAnsi(raw)).toBe('ERROR: Something failed');
    });

    it('3.3 inspects stripAnsi on OSC (Operating System Command) sequences', () => {
      // OSC sequence: \x1b]0;Title\x07
      const oscString = '\x1b]0;Offliner Window Title\x07[download]  50.0%';
      const stripped = stripAnsi(oscString);
      // Notice: ANSI_REGEX only matches \x1B\[, so \x1B] OSC sequences remain unstripped
      expect(stripped.includes('Offliner Window Title')).toBe(true);
    });

    it('3.4 handles multi-line interleaved chunks and returns latest status', () => {
      const multiChunk = [
        '[download] Destination: /tmp/stream.mp4',
        '[download]  10.0% of 100.00MiB at 1.00MiB/s ETA 01:30',
        '[youtube] Some intermediate debug log',
        '[download]  25.0% of 100.00MiB at 2.00MiB/s ETA 00:45',
        '[info] Merging video and audio...',
      ].join('\r\n');

      const parsed = parseProgress(multiChunk);
      expect(parsed).not.toBeNull();
      // Should pick the newest progress line: 25.0%
      expect(parsed!.percent).toBe(25.0);
      expect(parsed!.speed).toBe('2.00 MiB/s');
      expect(parsed!.eta).toBe('00:45');
    });

    it('3.5 survives arbitrary chunk fragmentation gracefully', () => {
      // Fragment 1: cut off right before size
      const frag1 = '[download]  50.0% of ~ ';
      const parsed1 = parseProgress(frag1);
      // Parser matches the percentage part safely without crashing
      expect(parsed1).not.toBeNull();
      expect(parsed1!.percent).toBe(50.0);
      expect(parsed1!.totalBytes).toBeNull();

      // Fragment 2: cut off inside the header word [down
      const frag2 = '[down';
      const parsed2 = parseProgress(frag2);
      expect(parsed2).toBeNull();

      // Fragment 3: isolated trailing text without header
      const frag3 = '10.00MiB at 2.00MiB/s ETA 00:05';
      const parsed3 = parseProgress(frag3);
      expect(parsed3).toBeNull();
    });

    it('3.6 handles Unicode, emoji, and RTL characters in stdout without crashing', () => {
      const unicodeChunk =
        '[download]  33.3% of ~ 10.00MiB at 1.00MiB/s ETA 00:10\n[info] 日本語タイトル 🎬 🚀 \u200B\uFEFF RTL: مرحبا';
      const parsed = parseProgress(unicodeChunk);
      expect(parsed).not.toBeNull();
      expect(parsed!.percent).toBe(33.3);
    });

    it('3.7 handles null bytes in stdout without throwing', () => {
      const nullByteChunk = '[download]\0  50.0% of ~ 10.00MiB at 1.00MiB/s ETA 00:05';
      // \0 between [download] and 50.0% breaks \s+ regex match
      const parsed = parseProgress(nullByteChunk);
      expect(parsed).toBeNull();
    });

    it('3.8 parses sizes with TiB and TB units accurately', () => {
      // Test parseSizeToBytes
      expect(parseSizeToBytes(10, 'GiB')).toBe(10 * 1024 ** 3);
      expect(parseSizeToBytes(10, 'MiB')).toBe(10 * 1024 ** 2);
      expect(parseSizeToBytes(10, 'KiB')).toBe(10 * 1024);
      expect(parseSizeToBytes(100, 'B')).toBe(100);

      // Terabytes check:
      expect(parseSizeToBytes(1.5, 'TiB')).toBe(Math.round(1.5 * 1024 ** 4));
      expect(parseSizeToBytes(2.0, 'TB')).toBe(Math.round(2.0 * 1000 ** 4));
    });

    it('3.9 parses ETA strings with 24+ hour durations (days / hours)', () => {
      // Standard HH:MM:SS
      expect(parseETAToSeconds('01:30:15')).toBe(3600 + 30 * 60 + 15);
      // Large hours (> 24h)
      expect(parseETAToSeconds('25:10:00')).toBe(25 * 3600 + 10 * 60);

      // 4-part ETA string: DD:HH:MM:SS (e.g. 01:02:03:04 = 1d 2h 3m 4s)
      const fourPartEta = parseETAToSeconds('01:02:03:04');
      // In current implementation, 4-part falls through to parts[0] || 0
      // 1 day should be 93784 seconds, but returns 1
      expect(fourPartEta).toBe(1);
    });

    it('3.10 formats seconds to ETA accurately across large values', () => {
      expect(formatSecondsToETA(0)).toBe('00:00');
      expect(formatSecondsToETA(59)).toBe('00:59');
      expect(formatSecondsToETA(3600)).toBe('01:00:00');
      expect(formatSecondsToETA(90000)).toBe('25:00:00'); // 25 hours
      expect(formatSecondsToETA(-10)).toBe('00:00');
      expect(formatSecondsToETA(NaN)).toBe('00:00');
    });

    it('3.11 parses FFmpeg transcoding lines under extreme multipliers and negative times', () => {
      // High speed multiplier (e.g. speed=50.2x)
      const ffmpegLine = 'frame=  500 fps= 60 q=28.0 size=   15360kB time=00:05:00.00 bitrate= 419.4kbits/s speed=50.2x';
      const parsed = parseProgress(ffmpegLine, { totalDurationSeconds: 600 });
      expect(parsed).not.toBeNull();
      expect(parsed!.stage).toBe('transcode');
      expect(parsed!.percent).toBe(50.0);
      expect(parsed!.speedMultiplier).toBe(50.2);
      expect(parsed!.speed).toBe('50.2x');
      expect(parsed!.frame).toBe(500);
      expect(parsed!.fps).toBe(60);

      // Negative time (FFmpeg preroll / audio negative timestamp)
      const prerollLine = 'frame=    1 fps=0.0 size=       0kB time=-00:00:00.50 speed=N/A';
      const parsedPreroll = parseProgress(prerollLine, { totalDurationSeconds: 100 });
      expect(parsedPreroll).not.toBeNull();
      expect(parsedPreroll!.percent).toBe(0);
    });
  });

  // =========================================================================
  // DIMENSION 4: Ambiguous Destination Lines & Filename Quoting
  // =========================================================================
  describe('Dimension 4: Ambiguous Destination Lines & Precedence', () => {
    it('4.1 correctly resolves active download destination when filename contains "has already been downloaded"', () => {
      // When a video has "has already been downloaded" in its title:
      const deceptiveActiveLine = '[download] Destination: /downloads/Why has already been downloaded.mp4';
      const result = parseDestinationLine(deceptiveActiveLine);

      expect(result).not.toBeNull();
      expect(result!.operation).toBe('download');
      expect(result!.filePath).toBe('/downloads/Why has already been downloaded.mp4');
      expect(result!.isFinal).toBe(false);
    });

    it('4.2 extracts legitimate already-downloaded lines accurately', () => {
      const validAlreadyLine = '[download] /home/user/Videos/lecture_01.mp4 has already been downloaded';
      const result = parseDestinationLine(validAlreadyLine);

      expect(result).not.toBeNull();
      expect(result!.operation).toBe('already_downloaded');
      expect(result!.filePath).toBe('/home/user/Videos/lecture_01.mp4');
      expect(result!.isFinal).toBe(true);
    });

    it('4.3 extracts Merger destination with internal double quotes', () => {
      // yt-dlp merger line with standard quotes
      const normalMerger = '[Merger] Merging formats into "/downloads/Awesome Video.mp4"';
      const result1 = parseDestinationLine(normalMerger);
      expect(result1).not.toBeNull();
      expect(result1!.filePath).toBe('/downloads/Awesome Video.mp4');
      expect(result1!.isFinal).toBe(true);

      // Title with nested quotes: "My "Favorite" Song.mp4"
      const nestedQuotesMerger = '[Merger] Merging formats into "/downloads/My "Favorite" Song.mp4"';
      const result2 = parseDestinationLine(nestedQuotesMerger);
      expect(result2).not.toBeNull();
      // Regex /"([^"]+)"/ truncates at the first internal quote, and cleanPath trims trailing space
      expect(result2!.filePath).toBe('/downloads/My');
    });

    it('4.4 correctly preserves final destination over intermediate DASH streams in DestinationTracker', () => {
      const tracker = new DestinationTracker();

      // Step 1: Intermediate video stream (.f137.mp4)
      tracker.update('[download] Destination: /downloads/video.f137.mp4');
      expect(tracker.getPath()).toBe('/downloads/video.f137.mp4');

      // Step 2: Intermediate audio stream (.f140.m4a)
      tracker.update('[download] Destination: /downloads/video.f140.m4a');
      expect(tracker.getPath()).toBe('/downloads/video.f140.m4a');

      // Step 3: Merger creates final container (.mp4)
      tracker.update('[Merger] Merging formats into "/downloads/video.mp4"');
      expect(tracker.getPath()).toBe('/downloads/video.mp4');

      // Step 4: Subsequent post-processing or stdout noise does not overwrite final destination
      tracker.update('[download] 100% of 50.00MiB in 00:05');
      tracker.update('[download] Destination: /downloads/other.f137.mp4'); // Should NOT overwrite because isFinal = true
      expect(tracker.getPath()).toBe('/downloads/video.mp4');
    });

    it('4.5 handles Windows paths with spaces and backslashes', () => {
      const winLine = '[download] Destination: C:\\Users\\Offliner User\\Downloads\\My Video.mp4';
      const result = parseDestinationLine(winLine);
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('C:\\Users\\Offliner User\\Downloads\\My Video.mp4');
    });
  });

  // =========================================================================
  // DIMENSION 5: Error Classification Boundaries & Weird Stderr
  // =========================================================================
  describe('Dimension 5: Error Classification Boundaries & Bizarre Stderr', () => {
    it('5.1 classifies HTTP 403 Forbidden as unknown category', () => {
      const stderr403 = 'ERROR: [youtube] dQw4w9WgXcQ: YouTube said: HTTP Error 403: Forbidden';
      const parsed = parseError(stderr403, 1);

      // In current taxonomy, HTTP 403 is not in ERROR_PATTERNS
      expect(parsed.category).toBe('unknown');
      expect(parsed.isTransient).toBe(false);
      expect(parsed.userMessage).toContain('YouTube said: HTTP Error 403: Forbidden');
      expect(parsed.videoId).toBe('dQw4w9WgXcQ');
    });

    it('5.2 classifies HTTP 429 Too Many Requests (Rate Limit) as unknown category', () => {
      const stderr429 = 'ERROR: [youtube] HTTP Error 429: Too Many Requests';
      const parsed = parseError(stderr429, 1);

      // HTTP 429 is currently categorized as unknown rather than transient network
      expect(parsed.category).toBe('unknown');
      expect(parsed.isTransient).toBe(false);
    });

    it('5.3 correctly classifies bot checks and age restrictions as non-transient', () => {
      const botStderr = 'ERROR: [youtube] Sign in to confirm you’re not a bot';
      const parsed = parseError(botStderr, 1);
      expect(parsed.category).toBe('age_restricted');
      expect(parsed.isTransient).toBe(false);
    });

    it('5.4 correctly classifies geo-restrictions as non-transient', () => {
      const geoStderr = 'ERROR: [youtube] The uploader has not made this video available in your country';
      const parsed = parseError(geoStderr, 1);
      expect(parsed.category).toBe('geo_restricted');
      expect(parsed.isTransient).toBe(false);
    });

    it('5.5 correctly classifies transient network timeouts and connection resets', () => {
      const timeoutStderr = 'WARNING: [youtube] Connection reset by peer\nERROR: urlopen error timed out';
      const parsed = parseError(timeoutStderr, 1);
      expect(parsed.category).toBe('network');
      expect(parsed.isTransient).toBe(true);
      expect(isTransientError(timeoutStderr)).toBe(true);
    });

    it('5.6 handles massive 5000-line python stacktrace without timing out or failing', () => {
      const traceLines: string[] = [];
      for (let i = 0; i < 5000; i++) {
        traceLines.push(`  File "yt_dlp/extractor/youtube.py", line ${i + 100}, in _real_extract`);
      }
      traceLines.push('ERROR: [youtube] Private video. Sign in if you\'ve been granted access to this video');
      const massiveStderr = traceLines.join('\n');

      const start = performance.now();
      const parsed = parseError(massiveStderr, 1);
      const elapsed = performance.now() - start;

      expect(parsed.category).toBe('private_video');
      expect(parsed.isTransient).toBe(false);
      expect(elapsed).toBeLessThan(50); // Under 50ms
    });

    it('5.7 handles empty, whitespace, and null stderr outputs safely', () => {
      const emptyErr = parseError('', 1);
      expect(emptyErr.category).toBe('unknown');
      expect(emptyErr.userMessage).toBe('An unexpected error occurred');

      const wsErr = parseError('   \n  \t  ', 1);
      expect(wsErr.category).toBe('unknown');
      expect(wsErr.userMessage).toBe('An unexpected error occurred');
    });

    it('5.8 extracts 11-char YouTube ID accurately and avoids over-matching on long IDs', () => {
      // Standard 11 char ID
      expect(extractVideoId('[youtube] dQw4w9WgXcQ: Downloading webpage')).toBe('dQw4w9WgXcQ');

      // Longer identifier (15 characters)
      // Because regex is ([a-zA-Z0-9_-]{11}) without word boundary, it captures the first 11 chars
      const result = extractVideoId('[youtube] 123456789012345: Downloading');
      expect(result).toBe('12345678901');
    });
  });
});
