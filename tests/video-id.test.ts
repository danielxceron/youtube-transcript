import { describe, expect, it } from 'vitest';
import { YoutubeTranscriptError } from '../src/errors';
import { retrieveVideoId } from '../src/video-id';

const VIDEO_ID = 'dQw4w9WgXcQ';

describe('retrieveVideoId', () => {
  const accepted: Array<[string, string]> = [
    ['raw id', VIDEO_ID],
    ['padded id', `  ${VIDEO_ID}  `],
    ['watch url', `https://www.youtube.com/watch?v=${VIDEO_ID}`],
    ['http url', `http://youtube.com/watch?v=${VIDEO_ID}`],
    ['watch url with list', `https://www.youtube.com/watch?v=${VIDEO_ID}&list=PL123&index=2`],
    ['watch url with v last', `https://www.youtube.com/watch?feature=share&v=${VIDEO_ID}`],
    ['mobile url', `https://m.youtube.com/watch?v=${VIDEO_ID}`],
    ['music url', `https://music.youtube.com/watch?v=${VIDEO_ID}&feature=share`],
    ['short url', `https://youtu.be/${VIDEO_ID}`],
    ['short url with time', `https://youtu.be/${VIDEO_ID}?t=42`],
    ['shorts url', `https://www.youtube.com/shorts/${VIDEO_ID}`],
    ['live url', `https://www.youtube.com/live/${VIDEO_ID}?si=abc`],
    ['embed url', `https://www.youtube.com/embed/${VIDEO_ID}`],
    ['legacy v url', `https://www.youtube.com/v/${VIDEO_ID}`],
    ['nocookie url', `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`],
    ['id with hyphens and underscores', 'a_B-cD1eF2G'],
  ];

  it.each(accepted)('accepts %s', (_label, input) => {
    expect(retrieveVideoId(input)).toBe(input.startsWith('a_B') ? input : VIDEO_ID);
  });

  const rejected: Array<[string, string]> = [
    ['empty', ''],
    ['too short', 'abc'],
    ['too long', 'dQw4w9WgXcQx'],
    ['invalid characters', 'dQw4w9WgXc!'],
    ['unrelated url', `https://example.com/watch?v=${VIDEO_ID}`],
    ['plain text', 'not a video id'],
  ];

  it.each(rejected)('rejects %s', (_label, input) => {
    expect(() => retrieveVideoId(input)).toThrow(YoutubeTranscriptError);
  });

  it('uses the legacy error message', () => {
    expect(() => retrieveVideoId('bad')).toThrow('Impossible to retrieve Youtube video ID.');
  });

  it('rejects non string input', () => {
    expect(() => retrieveVideoId(undefined as unknown as string)).toThrow(YoutubeTranscriptError);
  });
});
