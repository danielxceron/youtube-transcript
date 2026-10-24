import { describe, expect, it } from 'vitest';
import { matchesLanguage, normalizeLanguage, selectCaptionTrack } from '../src/languages';
import { ASR_TRACK, GERMAN_TRACK, MANUAL_TRACK, TRACKS } from './helpers';

describe('normalizeLanguage', () => {
  it('normalizes case, whitespace and separators', () => {
    expect(normalizeLanguage(' EN_us ')).toBe('en-us');
    expect(normalizeLanguage('pt-BR')).toBe('pt-br');
    expect(normalizeLanguage('')).toBeUndefined();
    expect(normalizeLanguage(undefined)).toBeUndefined();
  });
});

describe('matchesLanguage', () => {
  it('matches exact languages', () => {
    expect(matchesLanguage('en', 'en')).toBe(true);
    expect(matchesLanguage('de-DE', 'de-DE')).toBe(true);
  });

  it('matches regional variants by prefix', () => {
    expect(matchesLanguage('en-US', 'en')).toBe(true);
    expect(matchesLanguage('pt-BR', 'pt')).toBe(true);
    expect(matchesLanguage('de-DE', 'DE')).toBe(true);
  });

  it('does not match unrelated languages', () => {
    expect(matchesLanguage('en', 'de')).toBe(false);
    expect(matchesLanguage('english', 'en')).toBe(false);
  });
});

describe('selectCaptionTrack', () => {
  it('prefers manual captions when no language is requested', () => {
    expect(selectCaptionTrack(TRACKS)).toBe(MANUAL_TRACK);
  });

  it('falls back to automatic captions', () => {
    expect(selectCaptionTrack([ASR_TRACK])).toBe(ASR_TRACK);
  });

  it('falls back to the first track', () => {
    expect(selectCaptionTrack([GERMAN_TRACK])).toBe(GERMAN_TRACK);
  });

  it('selects the requested language including regional variants', () => {
    expect(selectCaptionTrack(TRACKS, 'de')).toBe(GERMAN_TRACK);
    expect(selectCaptionTrack(TRACKS, 'de-de')).toBe(GERMAN_TRACK);
  });

  it('prefers manual captions within the requested language', () => {
    expect(selectCaptionTrack([ASR_TRACK, MANUAL_TRACK], 'en')).toBe(MANUAL_TRACK);
  });

  it('returns undefined when the language is not available', () => {
    expect(selectCaptionTrack(TRACKS, 'fr')).toBeUndefined();
  });

  it('returns undefined for an empty track list', () => {
    expect(selectCaptionTrack([])).toBeUndefined();
  });
});
