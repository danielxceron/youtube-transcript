import { YoutubeTranscriptAbortError, YoutubeTranscriptNetworkError } from './errors';
import type { FetchLike } from './types';

const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 2;
const DEFAULT_CONCURRENCY = 6;
const MAX_BACKOFF_MS = 8000;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface HttpClientOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  retries?: number;
  concurrency?: number;
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  cookie?: string;
}

export interface HttpResult {
  status: number;
  ok: boolean;
  url: string;
  headers: Headers;
  body: string;
  json<T>(): T;
}

export class HttpClient {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly maxConcurrency: number;
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(options: HttpClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = Math.max(0, Math.floor(options.retries ?? DEFAULT_RETRIES));
    this.maxConcurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY));
  }

  async request(
    url: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<HttpResult> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const maxAttempts = Math.max(1, Math.floor(options.retries ?? this.retries) + 1);
    const headers = new Headers(init.headers);
    if (options.cookie) headers.set('Cookie', options.cookie);

    let attempt = 0;
    for (;;) {
      if (options.signal?.aborted) throw new YoutubeTranscriptAbortError();

      await this.acquire(options.signal);
      if (options.signal?.aborted) {
        this.release();
        throw new YoutubeTranscriptAbortError();
      }

      const controller = new AbortController();
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => controller.abort(options.signal?.reason);

      if (options.signal) {
        options.signal.addEventListener('abort', onAbort, { once: true });
        if (options.signal.aborted) onAbort();
      }
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort(new Error('timeout'));
        }, timeoutMs);
        (timer as { unref?: () => void }).unref?.();
      }

      let response: Response;
      let body: string;
      try {
        response = await this.fetchImpl(url, { ...init, headers, signal: controller.signal });
        body = await response.text();
      } catch (error) {
        this.release();
        this.cleanupRequest(timer, options.signal, onAbort);

        if (options.signal?.aborted) throw new YoutubeTranscriptAbortError();
        if (attempt + 1 >= maxAttempts) {
          const reason = timedOut
            ? `Request timed out after ${timeoutMs}ms`
            : `Request failed after ${attempt + 1} attempt(s)`;
          throw new YoutubeTranscriptNetworkError(`${reason}: ${url}`, error);
        }

        await delay(this.backoffMs(attempt, null), options.signal);
        attempt += 1;
        continue;
      }

      this.release();
      this.cleanupRequest(timer, options.signal, onAbort);

      if (RETRYABLE_STATUS.has(response.status) && attempt + 1 < maxAttempts) {
        const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
        await delay(this.backoffMs(attempt, retryAfter), options.signal);
        attempt += 1;
        continue;
      }

      return {
        status: response.status,
        ok: response.ok,
        url: response.url || url,
        headers: response.headers,
        body,
        json<T>(): T {
          return JSON.parse(body) as T;
        },
      };
    }
  }

  private cleanupRequest(
    timer: ReturnType<typeof setTimeout> | undefined,
    signal: AbortSignal | undefined,
    onAbort: () => void,
  ): void {
    if (timer !== undefined) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }

  private backoffMs(attempt: number, retryAfter: number | null): number {
    if (retryAfter !== null) return Math.min(MAX_BACKOFF_MS, retryAfter);
    const cap = Math.min(MAX_BACKOFF_MS, 300 * 2 ** attempt);
    return Math.round(cap * (0.5 + Math.random() * 0.5));
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new YoutubeTranscriptAbortError());
        return;
      }

      const onAbort = () => {
        const index = this.waiters.indexOf(grant);
        if (index !== -1) this.waiters.splice(index, 1);
        signal?.removeEventListener('abort', onAbort);
        reject(new YoutubeTranscriptAbortError());
      };

      const grant = () => {
        signal?.removeEventListener('abort', onAbort);
        this.active += 1;
        resolve();
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiters.push(grant);
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.waiters.shift();
    if (next) next();
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));

  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());

  return null;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new YoutubeTranscriptAbortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new YoutubeTranscriptAbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
