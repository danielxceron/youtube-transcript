import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranscriptCache } from '../src/cache';
import type { TranscriptResponse } from '../src/types';

const SEGMENTS: TranscriptResponse[] = [{ text: 'hola', duration: 1, offset: 0 }];

afterEach(() => {
  vi.useRealTimers();
});

describe('TranscriptCache', () => {
  it('stores and returns values', () => {
    const cache = new TranscriptCache();
    cache.set('a', SEGMENTS);

    expect(cache.get('a')).toBe(SEGMENTS);
    expect(cache.get('missing')).toBeUndefined();
    expect(cache.size).toBe(1);
  });

  it('expires entries after the ttl', () => {
    vi.useFakeTimers();
    const cache = new TranscriptCache({ ttlMs: 1000 });
    cache.set('a', SEGMENTS);

    vi.advanceTimersByTime(999);
    expect(cache.get('a')).toBe(SEGMENTS);

    vi.advanceTimersByTime(2);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('evicts the least recently used entry when full', () => {
    const cache = new TranscriptCache({ maxEntries: 2 });
    cache.set('a', SEGMENTS);
    cache.set('b', SEGMENTS);
    cache.get('a');
    cache.set('c', SEGMENTS);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(SEGMENTS);
    expect(cache.get('c')).toBe(SEGMENTS);
  });

  it('does not store anything when the ttl is zero', () => {
    const cache = new TranscriptCache({ ttlMs: 0 });
    cache.set('a', SEGMENTS);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('clears every entry', () => {
    const cache = new TranscriptCache();
    cache.set('a', SEGMENTS);
    cache.set('b', SEGMENTS);
    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});
