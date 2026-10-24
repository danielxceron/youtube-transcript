import type { CaptionTrack, InnerTubeClient } from './types';

export const YOUTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
export const YOUTUBE_PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player';

export const DEFAULT_CLIENTS: InnerTubeClient[] = [
  {
    name: 'ANDROID',
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    clientNumber: '3',
    userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip',
    context: { androidSdkVersion: 34 },
  },
  {
    name: 'IOS',
    clientName: 'IOS',
    clientVersion: '20.10.4',
    clientNumber: '5',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    context: { deviceModel: 'iPhone16,2' },
  },
];

export interface PlayabilityStatus {
  status: string;
  reason?: string;
}

export function playerHeaders(client: InnerTubeClient): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': client.userAgent,
    'X-YouTube-Client-Name': client.clientNumber,
    'X-YouTube-Client-Version': client.clientVersion,
  };
}

export function playerRequestBody(
  client: InnerTubeClient,
  videoId: string,
  language: string
): Record<string, unknown> {
  return {
    context: {
      client: {
        ...client.context,
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        hl: language,
        gl: 'US',
      },
    },
    videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
}

export function readCaptionTracks(payload: unknown): CaptionTrack[] | undefined {
  const tracks = (
    payload as
      | {
          captions?: {
            playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
          };
        }
      | undefined
  )?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

  return Array.isArray(tracks) ? tracks.filter((track) => Boolean(track?.baseUrl)) : undefined;
}

export function readPlayability(payload: unknown): PlayabilityStatus {
  const playability = (
    payload as { playabilityStatus?: { status?: string; reason?: string } } | undefined
  )?.playabilityStatus;

  return { status: playability?.status ?? '', reason: playability?.reason };
}
