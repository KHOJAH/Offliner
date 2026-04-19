// src/worker/fs-utils.ts
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve, join, parse } from 'path';

export function sanitizePath(filePath: string): string {
  if (!filePath) return '';
  // Resolve first to get absolute path
  const absolutePath = resolve(filePath);
  const root = parse(absolutePath).root; // e.g., "C:\" or "/"
  const rest = absolutePath.substring(root.length);
  
  // Sanitize only the part after the root
  const sanitizedRest = rest.replace(/[<>:"|?*]/g, '_');
  return join(root, sanitizedRest);
}

export function ensureDirExists(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function deleteFileIfExists(filePath: string): void {
  if (existsSync(filePath)) {
    const { unlinkSync } = require('fs');
    unlinkSync(filePath);
  }
}

export function isValidPath(filePath: string): boolean {
  return filePath.length > 0 && !filePath.includes('\0');
}
