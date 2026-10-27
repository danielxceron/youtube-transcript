import type { CaptionTrack } from './types';

const CAPTIONS_MARKER = '"captions":';
const PLAYABILITY_PATTERN =
  /"playabilityStatus":\{"status":"([A-Z_]+)"(?:,"reason":"((?:[^"\\]|\\.)*)")?/;

export interface PlayabilityInfo {
  status?: string;
  reason?: string;
}

export function extractCaptionTracks(html: string): CaptionTrack[] | undefined {
  const markerIndex = html.indexOf(CAPTIONS_MARKER);
  if (markerIndex === -1) return undefined;

  let start = markerIndex + CAPTIONS_MARKER.length;
  while (start < html.length && /\s/.test(html[start])) start += 1;
  if (html[start] !== '{') return undefined;

  const end = findJsonObjectEnd(html, start);
  if (end === -1) return undefined;

  try {
    const parsed = JSON.parse(html.slice(start, end)) as {
      playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
    };
    const tracks = parsed.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) ? tracks.filter((track) => Boolean(track?.baseUrl)) : undefined;
  } catch {
    return undefined;
  }
}

export function extractPlayability(html: string): PlayabilityInfo {
  const match = PLAYABILITY_PATTERN.exec(html);
  if (!match) return {};

  return {
    status: match[1],
    reason: match[2] === undefined ? undefined : decodeJsonString(match[2]),
  };
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

function findJsonObjectEnd(source: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return -1;
}
