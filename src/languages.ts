import type { CaptionTrack } from './types';

export function normalizeLanguage(lang?: string): string | undefined {
  if (!lang) return undefined;
  const normalized = lang.trim().replace(/_/g, '-').toLowerCase();
  return normalized || undefined;
}

export function matchesLanguage(trackLanguage: string, requested: string): boolean {
  const track = normalizeLanguage(trackLanguage);
  const target = normalizeLanguage(requested);
  if (!track || !target) return false;
  return track === target || track.startsWith(`${target}-`);
}

export function selectCaptionTrack(
  tracks: CaptionTrack[],
  lang?: string,
): CaptionTrack | undefined {
  if (!tracks.length) return undefined;

  const manual = (track: CaptionTrack) => !track.kind || track.kind === 'standard';

  if (!lang) {
    return tracks.find(manual) ?? tracks.find((track) => track.kind === 'asr') ?? tracks[0];
  }

  const candidates = tracks.filter((track) => matchesLanguage(track.languageCode, lang));
  if (!candidates.length) return undefined;

  return (
    candidates.find(manual) ?? candidates.find((track) => track.kind === 'asr') ?? candidates[0]
  );
}
