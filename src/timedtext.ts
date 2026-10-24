import {
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptTooManyRequestError,
} from './errors';
import type { HttpClient, RequestOptions } from './http';
import { parseJson3, parseTimedText } from './parser';
import type { TranscriptResponse } from './types';

export interface TimedTextOptions {
  baseUrl: string;
  videoId: string;
  language: string;
  userAgent: string;
  request: RequestOptions;
}

export async function downloadTimedText(
  http: HttpClient,
  options: TimedTextOptions
): Promise<TranscriptResponse[]> {
  const result = await http.request(
    options.baseUrl,
    {
      headers: {
        'User-Agent': options.userAgent,
        'Accept-Language': options.language,
      },
    },
    options.request
  );

  if (result.status === 429) {
    throw new YoutubeTranscriptTooManyRequestError();
  }
  if (!result.ok) {
    throw new YoutubeTranscriptNotAvailableError(options.videoId);
  }

  const body = result.body.trim();
  if (!body) return [];

  if (body.startsWith('{') || body.startsWith('[')) {
    try {
      return parseJson3(JSON.parse(body), options.language);
    } catch {
      return [];
    }
  }

  return parseTimedText(body, options.language);
}
