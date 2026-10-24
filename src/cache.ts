import type { CacheOptions, TranscriptResponse } from './types';

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 200;

interface CacheEntry {
  expiresAt: number;
  value: TranscriptResponse[];
}

export class TranscriptCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options: CacheOptions = {}) {
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_TTL_MS);
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? DEFAULT_MAX_ENTRIES));
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): TranscriptResponse[] | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: TranscriptResponse[]): void {
    if (this.ttlMs === 0) return;

    this.entries.delete(key);
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
