import { describe, expect, it, type TestContext } from 'vitest';
import { YoutubeTranscript } from '../src';
import {
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptRequestBlockedError,
} from '../src/errors';

const live = process.env.YOUTUBE_TRANSCRIPT_LIVE === '1';

function createClient() {
  return YoutubeTranscript.create({ cache: false, retries: 2, timeoutMs: 20000 });
}

function skipIfBlocked(ctx: TestContext, error: unknown): never {
  if (error instanceof YoutubeTranscriptRequestBlockedError) {
    ctx.skip(`YouTube blocked the runner IP: ${error.reason ?? error.message}`);
  }

  throw error;
}

async function liveFetch<T>(ctx: TestContext, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    return skipIfBlocked(ctx, error);
  }
}

describe.skipIf(!live)('live YouTube integration', () => {
  it('fetches a manually captioned video', async (ctx) => {
    const transcript = await liveFetch(ctx, () => createClient().fetchTranscript('jNQXAC9IVRw'));

    expect(transcript.length).toBeGreaterThan(0);
    expect(transcript.every((segment) => segment.text.length > 0)).toBe(true);
    expect(transcript[0].offset).toBeGreaterThanOrEqual(0);
    expect(transcript.every((segment) => segment.lang === 'en')).toBe(true);
  }, 40000);

  it('fetches an automatic transcript', async (ctx) => {
    const transcript = await liveFetch(ctx, () => createClient().fetchTranscript('9bZkp7q19f0'));

    expect(transcript.length).toBeGreaterThan(10);
    expect(transcript.every((segment) => segment.lang === 'ko')).toBe(true);
  }, 40000);

  it('honours the requested language', async (ctx) => {
    const transcript = await liveFetch(ctx, () =>
      createClient().fetchTranscript('dQw4w9WgXcQ', { lang: 'de' }),
    );

    expect(transcript.length).toBeGreaterThan(0);
    expect(transcript.every((segment) => segment.lang === 'de-DE')).toBe(true);
  }, 40000);

  it('accepts a short url', async (ctx) => {
    const transcript = await liveFetch(ctx, () =>
      createClient().fetchTranscript('https://youtu.be/dQw4w9WgXcQ'),
    );

    expect(transcript.length).toBeGreaterThan(0);
  }, 40000);

  it('reports unavailable languages', async (ctx) => {
    let caught: unknown;
    try {
      await createClient().fetchTranscript('dQw4w9WgXcQ', { lang: 'xx' });
    } catch (error) {
      caught = error;
    }

    if (caught instanceof YoutubeTranscriptRequestBlockedError) {
      ctx.skip(`YouTube blocked the runner IP: ${caught.reason ?? caught.message}`);
    }

    expect(caught).toBeInstanceOf(YoutubeTranscriptNotAvailableLanguageError);
  }, 40000);

  it('fetches a batch of videos', async (ctx) => {
    const results = await createClient().fetchTranscripts(['jNQXAC9IVRw', 'dQw4w9WgXcQ']);
    const blocked = results.find(
      (result) => result.error instanceof YoutubeTranscriptRequestBlockedError,
    );

    if (blocked?.error instanceof YoutubeTranscriptRequestBlockedError) {
      ctx.skip(`YouTube blocked the runner IP: ${blocked.error.reason ?? blocked.error.message}`);
    }

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.error, `${result.videoId}: ${result.error?.message}`).toBeUndefined();
      expect(result.transcript?.length ?? 0).toBeGreaterThan(0);
    }
  }, 60000);
});
