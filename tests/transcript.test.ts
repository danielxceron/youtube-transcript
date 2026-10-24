import { describe, expect, it } from 'vitest';
import {
  YoutubeTranscriptAbortError,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptError,
  YoutubeTranscriptNetworkError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from '../src/errors';
import { YoutubeTranscript } from '../src/transcript';
import type { CreateTranscriptOptions } from '../src/types';
import {
  createFetchMock,
  GERMAN_TRACK,
  headerValue,
  isPlayerRequest,
  isTimedTextRequest,
  isWatchRequest,
  JSON3_PAYLOAD,
  MANUAL_TRACK,
  OTHER_VIDEO_ID,
  playerPayload,
  requestVideoId,
  SRV1_XML,
  SRV3_SEGMENTS_XML,
  SRV3_XML,
  textResponse,
  TRACKS,
  VIDEO_ID,
  watchPage,
  jsonResponse,
  type FetchHandler,
} from './helpers';

function createClient(handler: FetchHandler, options: CreateTranscriptOptions = {}) {
  const mock = createFetchMock(handler);
  const client = YoutubeTranscript.create({ fetch: mock, retries: 0, cache: false, ...options });
  return { client, mock };
}

function standardHandler(
  overrides: Partial<Record<'player' | 'timedtext' | 'watch', () => Response>> = {},
): FetchHandler {
  return (url) => {
    if (isPlayerRequest(url)) return overrides.player?.() ?? jsonResponse(playerPayload());
    if (isTimedTextRequest(url)) return overrides.timedtext?.() ?? textResponse(SRV3_XML);
    if (isWatchRequest(url)) return overrides.watch?.() ?? textResponse(watchPage());
    return undefined;
  };
}

describe('YoutubeTranscript.fetchTranscript', () => {
  it('parses a transcript through the InnerTube API', async () => {
    const { client, mock } = createClient(standardHandler());
    const transcript = await client.fetchTranscript(VIDEO_ID);

    expect(transcript).toEqual([
      { text: 'All right, so here we are', offset: 1.2, duration: 2.16, lang: 'en' },
      { text: "and that's cool & fine", offset: 5.318, duration: 2.656, lang: 'en' },
    ]);
    expect(mock.count('/youtubei/v1/player')).toBe(1);
    expect(mock.count('/api/timedtext')).toBe(1);
  });

  it('prefers manual captions over automatic ones', async () => {
    const { client, mock } = createClient(standardHandler());
    await client.fetchTranscript(VIDEO_ID);

    const timedText = mock.calls.find((call) => isTimedTextRequest(call.url));
    expect(timedText?.url).toBe(MANUAL_TRACK.baseUrl);
  });

  it('sends the InnerTube key and client headers', async () => {
    const { client, mock } = createClient(standardHandler());
    await client.fetchTranscript(VIDEO_ID);

    const player = mock.calls.find((call) => isPlayerRequest(call.url));
    expect(player?.url).toContain('key=AIza');
    expect(headerValue(player?.init, 'x-youtube-client-name')).toBe('3');
    expect(headerValue(player?.init, 'x-youtube-client-version')).toBe('20.10.38');
    expect(requestVideoId(player?.init)).toBe(VIDEO_ID);
  });

  it('selects a requested language including regional variants', async () => {
    const { client, mock } = createClient(standardHandler());
    const transcript = await client.fetchTranscript(VIDEO_ID, { lang: 'de' });

    const timedText = mock.calls.find((call) => isTimedTextRequest(call.url));
    expect(timedText?.url).toBe(GERMAN_TRACK.baseUrl);
    expect(transcript.every((segment) => segment.lang === 'de-DE')).toBe(true);
  });

  it('propagates the language to the request headers', async () => {
    const { client, mock } = createClient(standardHandler());
    await client.fetchTranscript(VIDEO_ID, { lang: 'de' });

    const player = mock.calls.find((call) => isPlayerRequest(call.url));
    const timedText = mock.calls.find((call) => isTimedTextRequest(call.url));
    expect(headerValue(player?.init, 'accept-language')).toBe('de');
    expect(headerValue(timedText?.init, 'accept-language')).toBe('de-DE');
  });

  it('rejects a language that is not available', async () => {
    const tracks = [{ ...MANUAL_TRACK, isTranslatable: false }];
    const { client } = createClient((url) => {
      if (isPlayerRequest(url)) return jsonResponse(playerPayload({ tracks }));
      if (isTimedTextRequest(url)) return textResponse(SRV3_XML);
      return textResponse(watchPage(tracks));
    });

    await expect(client.fetchTranscript(VIDEO_ID, { lang: 'fr' })).rejects.toBeInstanceOf(
      YoutubeTranscriptNotAvailableLanguageError,
    );
  });

  it('rotates to the next InnerTube client when one fails', async () => {
    let players = 0;
    const { client, mock } = createClient((url) => {
      if (isPlayerRequest(url)) {
        players += 1;
        return players === 1 ? textResponse('bad request', 400) : jsonResponse(playerPayload());
      }
      if (isTimedTextRequest(url)) return textResponse(SRV3_XML);
      return undefined;
    });

    const transcript = await client.fetchTranscript(VIDEO_ID);
    const playerCalls = mock.calls.filter((call) => isPlayerRequest(call.url));

    expect(transcript.length).toBe(2);
    expect(playerCalls).toHaveLength(2);
    expect(headerValue(playerCalls[1].init, 'x-youtube-client-name')).toBe('5');
  });

  it('falls back to html scraping when InnerTube has no captions', async () => {
    const { client, mock } = createClient(
      standardHandler({ player: () => jsonResponse(playerPayload({ tracks: null })) }),
    );
    const transcript = await client.fetchTranscript(VIDEO_ID);

    expect(transcript.length).toBe(2);
    expect(mock.count('/youtubei/v1/player')).toBe(2);
    expect(mock.count('/watch?v=')).toBe(1);
  });

  it('skips the html strategy when disabled', async () => {
    const { client, mock } = createClient(
      standardHandler({ player: () => jsonResponse(playerPayload({ tracks: null })) }),
      { htmlFallback: false },
    );

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptDisabledError,
    );
    expect(mock.count('/watch?v=')).toBe(0);
  });

  it('parses srv1 xml and json3 responses', async () => {
    const srv1 = createClient(standardHandler({ timedtext: () => textResponse(SRV1_XML) }));
    const json3 = createClient(
      standardHandler({ timedtext: () => textResponse(JSON.stringify(JSON3_PAYLOAD)) }),
    );

    expect((await srv1.client.fetchTranscript(VIDEO_ID))[0].text).toBe('Hola & adiós');
    expect((await json3.client.fetchTranscript(VIDEO_ID)).map((segment) => segment.text)).toEqual([
      'Hola mundo',
      'linea dos',
    ]);
  });

  it('parses automatic caption segments', async () => {
    const { client } = createClient(
      standardHandler({ timedtext: () => textResponse(SRV3_SEGMENTS_XML) }),
    );
    const transcript = await client.fetchTranscript(VIDEO_ID);

    expect(transcript.map((segment) => segment.text)).toEqual(['오반 강남 스타일', '강남 스타일']);
  });

  it('raises an empty transcript error when every strategy returns nothing', async () => {
    const { client } = createClient(standardHandler({ timedtext: () => textResponse('') }));

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptEmptyError,
    );
  });

  it('raises a video unavailable error for unplayable videos', async () => {
    const { client } = createClient(
      standardHandler({
        player: () => jsonResponse(playerPayload({ tracks: null, status: 'LOGIN_REQUIRED' })),
        watch: () => textResponse(watchPage(null, 'LOGIN_REQUIRED')),
      }),
    );

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptVideoUnavailableError,
    );
  });

  it('raises a disabled transcript error when captions are missing', async () => {
    const { client } = createClient(
      standardHandler({
        player: () => jsonResponse(playerPayload({ tracks: null })),
        watch: () => textResponse(watchPage(null)),
      }),
    );

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptDisabledError,
    );
  });

  it('does not keep trying strategies after a rate limit', async () => {
    const { client, mock } = createClient(
      standardHandler({ player: () => textResponse('too many', 429) }),
    );

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptTooManyRequestError,
    );
    expect(mock.count('/watch?v=')).toBe(0);
  });

  it('wraps transport failures in a network error', async () => {
    const { client } = createClient(() => {
      throw new Error('socket hang up');
    });

    await expect(client.fetchTranscript(VIDEO_ID)).rejects.toBeInstanceOf(
      YoutubeTranscriptNetworkError,
    );
  });

  it('stops immediately when the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const { client, mock } = createClient(standardHandler());

    await expect(
      client.fetchTranscript(VIDEO_ID, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(YoutubeTranscriptAbortError);
    expect(mock.calls).toHaveLength(0);
  });

  it('honours the cookie option on the html strategy', async () => {
    const { client, mock } = createClient(
      standardHandler({ player: () => jsonResponse(playerPayload({ tracks: null })) }),
    );
    await client.fetchTranscript(VIDEO_ID, { cookie: 'SID=abc' });

    const watch = mock.calls.find((call) => isWatchRequest(call.url));
    expect(headerValue(watch?.init, 'cookie')).toBe('SID=abc');
  });

  it('rejects invalid video identifiers', async () => {
    const { client } = createClient(standardHandler());

    await expect(client.fetchTranscript('definitely-not-a-video')).rejects.toBeInstanceOf(
      YoutubeTranscriptError,
    );
  });
});

describe('YoutubeTranscript cache', () => {
  it('reuses the transcript for identical requests', async () => {
    const mock = createFetchMock(standardHandler());
    const cached = YoutubeTranscript.create({
      fetch: mock,
      retries: 0,
      cache: { ttlMs: 10000 },
    });

    await cached.fetchTranscript(VIDEO_ID);
    await cached.fetchTranscript(VIDEO_ID);

    expect(mock.count('/youtubei/v1/player')).toBe(1);
  });

  it('keeps a separate entry per language', async () => {
    const { client, mock } = createClient(standardHandler(), { cache: { ttlMs: 10000 } });

    await client.fetchTranscript(VIDEO_ID);
    await client.fetchTranscript(VIDEO_ID, { lang: 'de' });

    expect(mock.count('/youtubei/v1/player')).toBe(2);
  });

  it('clears cached entries', async () => {
    const { client, mock } = createClient(standardHandler(), { cache: { ttlMs: 10000 } });

    await client.fetchTranscript(VIDEO_ID);
    client.clearCache();
    await client.fetchTranscript(VIDEO_ID);

    expect(mock.count('/youtubei/v1/player')).toBe(2);
  });
});

describe('YoutubeTranscript.fetchTranscripts', () => {
  it('fetches several videos and reports partial failures', async () => {
    const { client } = createClient((url, init) => {
      if (isPlayerRequest(url)) {
        const videoId = requestVideoId(init);
        return jsonResponse(
          playerPayload({
            tracks: [{ ...TRACKS[2], baseUrl: `${TRACKS[2].baseUrl}&v=${videoId}` }],
          }),
        );
      }
      if (isTimedTextRequest(url)) return textResponse(SRV3_XML);
      return undefined;
    });

    const results = await client.fetchTranscripts([VIDEO_ID, OTHER_VIDEO_ID, 'invalid']);

    expect(results).toHaveLength(3);
    expect(results[0].videoId).toBe(VIDEO_ID);
    expect(results[0].transcript).toHaveLength(2);
    expect(results[1].transcript).toHaveLength(2);
    expect(results[2].error).toBeInstanceOf(YoutubeTranscriptError);
  });

  it('deduplicates repeated identifiers', async () => {
    const { client } = createClient(standardHandler());
    const results = await client.fetchTranscripts([VIDEO_ID, VIDEO_ID]);

    expect(results).toHaveLength(1);
  });

  it('rejects a non array argument', async () => {
    const { client } = createClient(standardHandler());

    await expect(
      client.fetchTranscripts('dQw4w9WgXcQ' as unknown as string[]),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
