export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface InnerTubeClient {
  name: string;
  clientName: string;
  clientVersion: string;
  clientNumber: string;
  userAgent: string;
  context?: Record<string, unknown>;
}

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  isTranslatable?: boolean;
  vssId?: string;
  name?: unknown;
}

export interface TranscriptConfig {
  lang?: string;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
  cookie?: string;
}

export interface TranscriptResponse {
  text: string;
  duration: number;
  offset: number;
  lang?: string;
}

export interface CacheOptions {
  ttlMs?: number;
  maxEntries?: number;
}

export interface CreateTranscriptOptions {
  fetch?: FetchLike;
  retries?: number;
  timeoutMs?: number;
  concurrency?: number;
  cache?: boolean | CacheOptions;
  clients?: InnerTubeClient[];
  apiKey?: string;
  userAgent?: string;
  htmlFallback?: boolean;
}

export interface TranscriptBatchResult {
  videoId: string;
  transcript?: TranscriptResponse[];
  error?: Error;
}
