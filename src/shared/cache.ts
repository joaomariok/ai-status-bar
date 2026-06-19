import * as fs from 'fs';
import * as path from 'path';

export interface CacheEntry<T> {
  version?: number;
  stamp: number;
  value: T;
}

const CACHE_VERSION = 1;

export async function readCache<T>(file: string): Promise<CacheEntry<T> | undefined> {
  try {
    const parsed = JSON.parse(await fs.promises.readFile(file, 'utf8')) as CacheEntry<T>;
    return parsed.version === CACHE_VERSION ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache<T>(file: string, entry: CacheEntry<T>): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify({ ...entry, version: CACHE_VERSION }));
    await fs.promises.rename(tmp, file);
  } catch {
    // Cache writes are best-effort; stale status is better than a noisy extension host.
  }
}
