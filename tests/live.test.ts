import { describe, expect, it } from 'vitest';
import { YoutubeTranscript } from '../src';
import { YoutubeTranscriptNotAvailableLanguageError } from '../src/errors';

const live = process.env.YOUTUBE_TRANSCRIPT_LIVE === '1';

function createClient() {
  return YoutubeTranscript.create({ cache: false, retries: 1, timeoutMs: 20000 });
}

describe.skipIf(!live)('live YouTube integration', () => {
  it(
    'fetches a manually captioned video',
    async () => {
      const transcript = await createClient().fetchTranscript('jNQXAC9IVRw');

      expect(transcript.length).toBeGreaterThan(0);
      expect(transcript.every((segment) => segment.text.length > 0)).toBe(true);
      expect(transcript[0].offset).toBeGreaterThanOrEqual(0);
      expect(transcript.every((segment) => segment.lang === 'en')).toBe(true);
    },
    40000
  );

  it(
    'fetches an automatic transcript',
    async () => {
      const transcript = await createClient().fetchTranscript('9bZkp7q19f0');

      expect(transcript.length).toBeGreaterThan(10);
      expect(transcript.every((segment) => segment.lang === 'ko')).toBe(true);
    },
    40000
  );

  it(
    'honours the requested language',
    async () => {
      const transcript = await createClient().fetchTranscript('dQw4w9WgXcQ', { lang: 'de' });

      expect(transcript.length).toBeGreaterThan(0);
      expect(transcript.every((segment) => segment.lang === 'de-DE')).toBe(true);
    },
    40000
  );

  it(
    'accepts a short url',
    async () => {
      const transcript = await createClient().fetchTranscript('https://youtu.be/dQw4w9WgXcQ');

      expect(transcript.length).toBeGreaterThan(0);
    },
    40000
  );

  it(
    'reports unavailable languages',
    async () => {
      await expect(
        createClient().fetchTranscript('dQw4w9WgXcQ', { lang: 'xx' })
      ).rejects.toBeInstanceOf(YoutubeTranscriptNotAvailableLanguageError);
    },
    40000
  );

  it(
    'fetches a batch of videos',
    async () => {
      const results = await createClient().fetchTranscripts(['jNQXAC9IVRw', 'dQw4w9WgXcQ']);

      expect(results).toHaveLength(2);
      expect(results[0].transcript?.length).toBeGreaterThan(0);
      expect(results[1].transcript?.length).toBeGreaterThan(0);
    },
    60000
  );
});
