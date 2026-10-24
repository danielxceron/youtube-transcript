import type { CaptionTrack, FetchLike } from '../src/types';

export const VIDEO_ID = 'dQw4w9WgXcQ';
export const OTHER_VIDEO_ID = 'jNQXAC9IVRw';

export const MANUAL_TRACK: CaptionTrack = {
  baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en&fmt=srv3`,
  languageCode: 'en',
};

export const ASR_TRACK: CaptionTrack = {
  baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=en&kind=asr&fmt=srv3`,
  languageCode: 'en',
  kind: 'asr',
};

export const GERMAN_TRACK: CaptionTrack = {
  baseUrl: `https://www.youtube.com/api/timedtext?v=${VIDEO_ID}&lang=de-DE&fmt=srv3`,
  languageCode: 'de-DE',
};

export const TRACKS: CaptionTrack[] = [ASR_TRACK, MANUAL_TRACK, GERMAN_TRACK];

export const SRV3_XML = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<body>
<p t="1200" d="2160">All right, so here we are</p>
<p t="5318" d="2656">and that&#39;s cool &amp; fine</p>
</body>
</timedtext>`;

export const SRV3_SEGMENTS_XML = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3">
<body>
<p t="9960" d="3920" w="1"><s ac="0">오반</s><s t="480" ac="0"> 강남</s><s t="920" ac="0"> 스타일</s></p>
<p t="14030" w="1" a="1">
</p>
<p d="3479" t="14040" w="1"><s ac="0">강남</s><s t="479" ac="0"> 스타일</s></p>
</body>
</timedtext>`;

export const SRV1_XML = `<?xml version="1.0" encoding="utf-8" ?><transcript>
<text start="0" dur="1.5">Hola &amp; adi&#243;s</text>
<text start="1.5" dur="2">Second line<br>with break</text>
</transcript>`;

export const JSON3_PAYLOAD = {
  events: [
    { tStartMs: 0, dDurationMs: 1500, segs: [{ utf8: 'Hola' }, { utf8: ' mundo' }] },
    { tStartMs: 1500, dDurationMs: 500, segs: [{ utf8: '\n' }] },
    { tStartMs: 2000, dDurationMs: 1000, segs: [{ utf8: 'linea' }, { utf8: ' dos' }] },
  ],
};

export interface PlayerPayloadOptions {
  tracks?: CaptionTrack[] | null;
  status?: string;
  reason?: string;
}

export function playerPayload(options: PlayerPayloadOptions = {}): Record<string, unknown> {
  const tracks = options.tracks === undefined ? TRACKS : options.tracks;

  return {
    playabilityStatus: {
      status: options.status ?? 'OK',
      ...(options.reason ? { reason: options.reason } : {}),
    },
    ...(tracks === null
      ? {}
      : { captions: { playerCaptionsTracklistRenderer: { captionTracks: tracks } } }),
    videoDetails: { videoId: VIDEO_ID },
  };
}

export function watchPage(tracks: CaptionTrack[] | null = TRACKS, status = 'OK'): string {
  const captions =
    tracks === null
      ? 'null'
      : JSON.stringify({ playerCaptionsTracklistRenderer: { captionTracks: tracks } });

  return `<!doctype html><html><body><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"${status}"},"captions":${captions},"videoDetails":{"videoId":"${VIDEO_ID}"}};</script></body></html>`;
}

export function jsonResponse(
  payload: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function textResponse(
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

export interface FetchCall {
  url: string;
  init: RequestInit;
}

export interface FetchMock extends FetchLike {
  calls: FetchCall[];
  count(pattern: string | RegExp): number;
}

export type FetchHandler = (
  url: string,
  init: RequestInit,
) => Response | Promise<Response> | undefined;

export function createFetchMock(handler: FetchHandler): FetchMock {
  const calls: FetchCall[] = [];

  const mock = async (input: string, init: RequestInit = {}): Promise<Response> => {
    calls.push({ url: input, init });
    const response = await handler(input, init);
    if (!response) throw new Error(`Unexpected request: ${input}`);
    return response;
  };

  return Object.assign(mock, {
    calls,
    count(pattern: string | RegExp): number {
      return calls.filter((call) =>
        typeof pattern === 'string' ? call.url.includes(pattern) : pattern.test(call.url),
      ).length;
    },
  });
}

export function headerValue(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

export function requestVideoId(init: RequestInit | undefined): string | undefined {
  if (typeof init?.body !== 'string') return undefined;
  try {
    return (JSON.parse(init.body) as { videoId?: string }).videoId;
  } catch {
    return undefined;
  }
}

export function isPlayerRequest(url: string): boolean {
  return url.includes('/youtubei/v1/player');
}

export function isTimedTextRequest(url: string): boolean {
  return url.includes('/api/timedtext');
}

export function isWatchRequest(url: string): boolean {
  return url.includes('/watch?v=');
}
