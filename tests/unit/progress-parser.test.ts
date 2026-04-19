// tests/unit/progress-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseProgress, parseSizeToBytes } from '@/worker/progress-parser';

describe('parseProgress', () => {
  it('parses full progress line', () => {
    const line = '[download]  45.2% of ~  5.32MiB at    1.23MiB/s ETA 03:15';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(45.2);
    expect(result!.speed).toBe('1.23 MiB/s');
    expect(result!.eta).toBe('03:15');
  });

  it('parses percentage only', () => {
    const line = '[download]  75.0%';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(75.0);
    expect(result!.speed).toBeNull();
  });

  it('parses completion line', () => {
    const line = '[download] 100% of  123.45MiB in 00:45';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(100);
  });

  it('returns null for non-progress lines', () => {
    const line = '[info] Video title here';
    expect(parseProgress(line)).toBeNull();
  });

  it('handles zero percent', () => {
    const line = '[download]   0.0% of ~  10.00MiB at    2.00MiB/s ETA 00:05';
    const result = parseProgress(line);
    expect(result).not.toBeNull();
    expect(result!.percent).toBe(0);
  });
});

describe('parseSizeToBytes', () => {
  it('converts MiB correctly', () => {
    expect(parseSizeToBytes(1, 'MiB')).toBe(1024 * 1024);
  });
  it('converts GiB correctly', () => {
    expect(parseSizeToBytes(1, 'GiB')).toBe(1024 * 1024 * 1024);
  });
  it('converts KB correctly', () => {
    expect(parseSizeToBytes(1, 'KB')).toBe(1000);
  });
  it('returns 1 for unknown unit', () => {
    expect(parseSizeToBytes(5, 'XX')).toBe(5);
  });
});
