import { describe, expect, it } from 'vitest';
import { YoutubeTranscriptAbortError, YoutubeTranscriptNetworkError } from '../src/errors';
import { HttpClient } from '../src/http';
import { createFetchMock, headerValue, jsonResponse, textResponse } from './helpers';

describe('HttpClient', () => {
  it('returns the body and parsed json', async () => {
    const mock = createFetchMock(() => jsonResponse({ ok: true }));
    const client = new HttpClient({ fetch: mock });
    const result = await client.request('https://example.test/a');

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.json<{ ok: boolean }>()).toEqual({ ok: true });
  });

  it('sends custom headers and the cookie', async () => {
    const mock = createFetchMock(() => textResponse('ok'));
    const client = new HttpClient({ fetch: mock });
    await client.request(
      'https://example.test/a',
      { headers: { 'User-Agent': 'agent' } },
      { cookie: 'SID=abc' },
    );

    expect(headerValue(mock.calls[0].init, 'user-agent')).toBe('agent');
    expect(headerValue(mock.calls[0].init, 'cookie')).toBe('SID=abc');
  });

  it('retries retryable server errors', async () => {
    let attempts = 0;
    const mock = createFetchMock(() => {
      attempts += 1;
      return attempts === 1 ? textResponse('boom', 500) : textResponse('ok');
    });
    const client = new HttpClient({ fetch: mock, retries: 2 });
    const result = await client.request('https://example.test/retry');

    expect(result.status).toBe(200);
    expect(mock.calls).toHaveLength(2);
  });

  it('does not retry client errors', async () => {
    const mock = createFetchMock(() => textResponse('bad', 400));
    const client = new HttpClient({ fetch: mock, retries: 2 });
    const result = await client.request('https://example.test/400');

    expect(result.status).toBe(400);
    expect(result.ok).toBe(false);
    expect(mock.calls).toHaveLength(1);
  });

  it('returns the last status once retries are exhausted', async () => {
    const mock = createFetchMock(() => textResponse('unavailable', 503));
    const client = new HttpClient({ fetch: mock, retries: 1 });
    const result = await client.request('https://example.test/503');

    expect(result.status).toBe(503);
    expect(mock.calls).toHaveLength(2);
  });

  it('honours retry-after', async () => {
    let attempts = 0;
    const mock = createFetchMock(() => {
      attempts += 1;
      return attempts === 1
        ? textResponse('slow down', 429, { 'retry-after': '0' })
        : textResponse('ok');
    });
    const client = new HttpClient({ fetch: mock, retries: 1 });
    const result = await client.request('https://example.test/429');

    expect(result.status).toBe(200);
    expect(mock.calls).toHaveLength(2);
  });

  it('throws a network error when fetch keeps failing', async () => {
    const mock = createFetchMock(() => {
      throw new Error('socket hang up');
    });
    const client = new HttpClient({ fetch: mock, retries: 1 });

    await expect(client.request('https://example.test/boom')).rejects.toBeInstanceOf(
      YoutubeTranscriptNetworkError,
    );
    expect(mock.calls).toHaveLength(2);
  });

  it('times out stalled requests', async () => {
    const mock = createFetchMock(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = new HttpClient({ fetch: mock, retries: 0, timeoutMs: 30 });

    await expect(client.request('https://example.test/slow')).rejects.toThrow(/timed out/i);
  });

  it('aborts when the external signal fires', async () => {
    const controller = new AbortController();
    const mock = createFetchMock(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const client = new HttpClient({ fetch: mock, retries: 0 });
    const pending = client.request('https://example.test/abort', {}, { signal: controller.signal });

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(YoutubeTranscriptAbortError);
  });

  it('rejects immediately when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const mock = createFetchMock(() => textResponse('ok'));
    const client = new HttpClient({ fetch: mock });

    await expect(
      client.request('https://example.test/aborted', {}, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(YoutubeTranscriptAbortError);
    expect(mock.calls).toHaveLength(0);
  });

  it('limits the number of in-flight requests', async () => {
    let active = 0;
    let maxActive = 0;

    const mock = createFetchMock(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return textResponse('ok');
    });
    const client = new HttpClient({ fetch: mock, concurrency: 2 });

    await Promise.all(
      Array.from({ length: 6 }, (_value, index) => client.request(`https://example.test/${index}`)),
    );

    expect(maxActive).toBe(2);
    expect(mock.calls).toHaveLength(6);
  });
});
