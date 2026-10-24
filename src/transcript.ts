import { TranscriptCache } from './cache';
import {
  YoutubeTranscriptAbortError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptError,
  YoutubeTranscriptNetworkError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from './errors';
import { extractCaptionTracks, extractPlayabilityStatus } from './html';
import { HttpClient, type RequestOptions } from './http';
import {
  DEFAULT_CLIENTS,
  YOUTUBE_API_KEY,
  YOUTUBE_PLAYER_ENDPOINT,
  playerHeaders,
  playerRequestBody,
  readCaptionTracks,
  readPlayability,
} from './innertube';
import { normalizeLanguage, selectCaptionTrack } from './languages';
import { downloadTimedText } from './timedtext';
import type {
  CreateTranscriptOptions,
  InnerTubeClient,
  TranscriptBatchResult,
  TranscriptConfig,
  TranscriptResponse,
} from './types';
import { retrieveVideoId } from './video-id';

const HTML_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const UNAVAILABLE_STATUSES = new Set([
  'LOGIN_REQUIRED',
  'UNPLAYABLE',
  'ERROR',
  'AGE_CHECK_REQUIRED',
  'CONTENT_CHECK_REQUIRED',
]);

interface Strategy {
  name: string;
  fetch: (
    identifier: string,
    lang: string | undefined,
    config: TranscriptConfig
  ) => Promise<TranscriptResponse[]>;
}

export class YoutubeTranscript {
  private static shared: YoutubeTranscript | undefined;

  private readonly http: HttpClient;
  private readonly cache: TranscriptCache | undefined;
  private readonly clients: InnerTubeClient[];
  private readonly apiKey: string;
  private readonly userAgent: string;
  private readonly htmlFallback: boolean;

  constructor(options: CreateTranscriptOptions = {}) {
    this.http = new HttpClient({
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
      concurrency: options.concurrency,
    });
    this.cache =
      options.cache === false
        ? undefined
        : new TranscriptCache(options.cache === undefined || options.cache === true ? {} : options.cache);
    this.clients = options.clients?.length ? options.clients : DEFAULT_CLIENTS;
    this.apiKey = options.apiKey ?? YOUTUBE_API_KEY;
    this.userAgent = options.userAgent ?? HTML_USER_AGENT;
    this.htmlFallback = options.htmlFallback ?? true;
  }

  static create(options: CreateTranscriptOptions = {}): YoutubeTranscript {
    return new YoutubeTranscript(options);
  }

  static fetchTranscript(videoId: string, config?: TranscriptConfig): Promise<TranscriptResponse[]> {
    return YoutubeTranscript.sharedInstance().fetchTranscript(videoId, config);
  }

  static fetchTranscripts(
    videoIds: string[],
    config?: TranscriptConfig
  ): Promise<TranscriptBatchResult[]> {
    return YoutubeTranscript.sharedInstance().fetchTranscripts(videoIds, config);
  }

  static clearCache(): void {
    YoutubeTranscript.sharedInstance().clearCache();
  }

  private static sharedInstance(): YoutubeTranscript {
    if (!YoutubeTranscript.shared) YoutubeTranscript.shared = new YoutubeTranscript();
    return YoutubeTranscript.shared;
  }

  async fetchTranscript(
    input: string,
    config: TranscriptConfig = {}
  ): Promise<TranscriptResponse[]> {
    const identifier = retrieveVideoId(input);
    const lang = normalizeLanguage(config.lang);
    const cacheKey = `${identifier}:${lang ?? ''}`;

    const cached = this.cache?.get(cacheKey);
    if (cached) return cached.map((segment) => ({ ...segment }));

    const errors: YoutubeTranscriptError[] = [];

    for (const strategy of this.strategies()) {
      try {
        const transcript = await strategy.fetch(identifier, lang, config);
        if (!transcript.length) throw new YoutubeTranscriptEmptyError(identifier, strategy.name);

        this.cache?.set(cacheKey, transcript.map((segment) => ({ ...segment })));
        return transcript;
      } catch (error) {
        const transcriptError = toTranscriptError(error, identifier);
        errors.push(transcriptError);

        if (
          transcriptError instanceof YoutubeTranscriptAbortError ||
          transcriptError instanceof YoutubeTranscriptTooManyRequestError
        ) {
          throw transcriptError;
        }
      }
    }

    throw errors[errors.length - 1] ?? new YoutubeTranscriptNotAvailableError(identifier);
  }

  async fetchTranscripts(
    videoIds: string[],
    config: TranscriptConfig = {}
  ): Promise<TranscriptBatchResult[]> {
    if (!Array.isArray(videoIds)) {
      throw new TypeError('videoIds must be an array of YouTube video ids or URLs');
    }

    const identifiers = [...new Set(videoIds)];
    return Promise.all(
      identifiers.map(async (videoId) => {
        try {
          return { videoId, transcript: await this.fetchTranscript(videoId, config) };
        } catch (error) {
          return { videoId, error: toTranscriptError(error, videoId) };
        }
      })
    );
  }

  clearCache(): void {
    this.cache?.clear();
  }

  private strategies(): Strategy[] {
    const strategies: Strategy[] = [
      {
        name: 'InnerTube API',
        fetch: (identifier, lang, config) => this.fetchWithInnerTube(identifier, lang, config),
      },
    ];

    if (this.htmlFallback) {
      strategies.push({
        name: 'HTML scraping',
        fetch: (identifier, lang, config) => this.fetchWithHtmlCaptions(identifier, lang, config),
      });
    }

    return strategies;
  }

  private async fetchWithInnerTube(
    identifier: string,
    lang: string | undefined,
    config: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    const errors: YoutubeTranscriptError[] = [];

    for (const client of this.clients) {
      try {
        return await this.fetchWithClient(client, identifier, lang, config);
      } catch (error) {
        const transcriptError = toTranscriptError(error, identifier);
        errors.push(transcriptError);

        if (
          transcriptError instanceof YoutubeTranscriptAbortError ||
          transcriptError instanceof YoutubeTranscriptTooManyRequestError
        ) {
          throw transcriptError;
        }
      }
    }

    throw errors[errors.length - 1] ?? new YoutubeTranscriptDisabledError(identifier);
  }

  private async fetchWithClient(
    client: InnerTubeClient,
    identifier: string,
    lang: string | undefined,
    config: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    const language = lang ?? 'en';
    const result = await this.http.request(
      `${YOUTUBE_PLAYER_ENDPOINT}?key=${encodeURIComponent(this.apiKey)}&prettyPrint=false`,
      {
        method: 'POST',
        headers: { ...playerHeaders(client), 'Accept-Language': language },
        body: JSON.stringify(playerRequestBody(client, identifier, language)),
      },
      this.requestOptions(config)
    );

    if (result.status === 429) throw new YoutubeTranscriptTooManyRequestError();
    if (!result.ok) {
      throw new YoutubeTranscriptNetworkError(
        `InnerTube request failed with status ${result.status} (${identifier})`
      );
    }

    let payload: unknown;
    try {
      payload = result.json();
    } catch (error) {
      throw new YoutubeTranscriptNetworkError(
        `Invalid InnerTube response for ${identifier}`,
        error
      );
    }

    const playability = readPlayability(payload);
    if (UNAVAILABLE_STATUSES.has(playability.status)) {
      throw new YoutubeTranscriptVideoUnavailableError(identifier);
    }

    const tracks = readCaptionTracks(payload);
    if (!tracks?.length) throw new YoutubeTranscriptDisabledError(identifier);

    const track = selectCaptionTrack(tracks, lang);
    if (!track) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        lang ?? language,
        tracks.map((item) => item.languageCode),
        identifier
      );
    }

    return downloadTimedText(this.http, {
      baseUrl: track.baseUrl,
      videoId: identifier,
      language: track.languageCode,
      userAgent: client.userAgent,
      request: this.requestOptions(config),
    });
  }

  private async fetchWithHtmlCaptions(
    identifier: string,
    lang: string | undefined,
    config: TranscriptConfig
  ): Promise<TranscriptResponse[]> {
    const language = lang ?? 'en';
    const result = await this.http.request(
      `https://www.youtube.com/watch?v=${identifier}`,
      {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': language,
        },
      },
      this.requestOptions(config)
    );

    if (result.status === 429) throw new YoutubeTranscriptTooManyRequestError();
    if (!result.ok) throw new YoutubeTranscriptNotAvailableError(identifier);

    const body = result.body;
    const tracks = extractCaptionTracks(body);

    if (!tracks?.length) {
      if (body.includes('class="g-recaptcha"')) {
        throw new YoutubeTranscriptTooManyRequestError();
      }

      const status = extractPlayabilityStatus(body);
      if (status && UNAVAILABLE_STATUSES.has(status)) {
        throw new YoutubeTranscriptVideoUnavailableError(identifier);
      }

      throw new YoutubeTranscriptDisabledError(identifier);
    }

    const track = selectCaptionTrack(tracks, lang);
    if (!track) {
      throw new YoutubeTranscriptNotAvailableLanguageError(
        lang ?? language,
        tracks.map((item) => item.languageCode),
        identifier
      );
    }

    return downloadTimedText(this.http, {
      baseUrl: track.baseUrl,
      videoId: identifier,
      language: track.languageCode,
      userAgent: this.userAgent,
      request: this.requestOptions(config),
    });
  }

  private requestOptions(config: TranscriptConfig): RequestOptions {
    return {
      timeoutMs: config.timeoutMs,
      retries: config.retries,
      signal: config.signal,
      cookie: config.cookie,
    };
  }
}

function toTranscriptError(error: unknown, videoId: string): YoutubeTranscriptError {
  if (error instanceof YoutubeTranscriptError) return error;

  const detail = error instanceof Error ? error.message : String(error);
  return new YoutubeTranscriptNetworkError(
    `Unexpected error while fetching transcript (${videoId}): ${detail}`,
    error
  );
}
