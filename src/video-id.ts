import { YoutubeTranscriptError } from './errors';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const URL_PATTERNS = [
  /(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?(?:[^#]*&)?v=|embed\/|v\/|shorts\/|live\/|e\/)([A-Za-z0-9_-]{11})/i,
  /youtu\.be\/([A-Za-z0-9_-]{11})/i,
];

export function retrieveVideoId(input: string): string {
  if (typeof input !== 'string') {
    throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
  }

  const value = input.trim();
  if (VIDEO_ID_PATTERN.test(value)) return value;

  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(value);
    if (match) return match[1];
  }

  throw new YoutubeTranscriptError('Impossible to retrieve Youtube video ID.');
}
