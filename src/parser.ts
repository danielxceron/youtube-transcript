import { decodeHtmlEntities } from './entities';
import type { TranscriptResponse } from './types';

const TEXT_ELEMENT = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
const PARAGRAPH_ELEMENT = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
const SEGMENT_ELEMENT = /<s\b[^>]*>([\s\S]*?)<\/s>/gi;
const ATTRIBUTE = /([A-Za-z_:][\w:.-]*)="([^"]*)"/g;
const BREAK = /<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;

interface Json3Segment {
  utf8?: string;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Segment[];
}

export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

export function normalizeText(value: string): string {
  return decodeHtmlEntities(value.replace(BREAK, ' ').replace(TAG, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseJson3(payload: unknown, lang?: string): TranscriptResponse[] {
  const events = (payload as { events?: Json3Event[] } | null | undefined)?.events;
  if (!Array.isArray(events)) return [];

  const segments: TranscriptResponse[] = [];
  for (const event of events) {
    const raw = Array.isArray(event.segs)
      ? event.segs.map((segment) => segment.utf8 ?? '').join('')
      : '';
    const text = normalizeText(raw);
    if (!text) continue;

    const offset = (event.tStartMs ?? 0) / 1000;
    const duration = (event.dDurationMs ?? 0) / 1000;
    segments.push({
      text,
      offset: Number.isFinite(offset) ? offset : 0,
      duration: Number.isFinite(duration) ? duration : 0,
      lang,
    });
  }
  return segments;
}

export function parseTimedText(xml: string, lang?: string): TranscriptResponse[] {
  if (!xml.trim()) return [];

  const textSegments = parseTextElements(xml, lang);
  const segments = textSegments.length ? textSegments : parseParagraphElements(xml, lang);
  return segments.sort((a, b) => a.offset - b.offset);
}

function parseTextElements(xml: string, lang?: string): TranscriptResponse[] {
  const segments: TranscriptResponse[] = [];

  for (const match of xml.matchAll(TEXT_ELEMENT)) {
    const attributes = parseAttributes(match[1]);
    const offset = Number(attributes.start);
    if (!Number.isFinite(offset)) continue;

    const text = normalizeText(match[2]);
    if (!text) continue;

    const duration = Number(attributes.dur ?? attributes.duration ?? 0);
    segments.push({
      text,
      offset,
      duration: Number.isFinite(duration) ? duration : 0,
      lang,
    });
  }

  return segments;
}

function parseParagraphElements(xml: string, lang?: string): TranscriptResponse[] {
  const segments: TranscriptResponse[] = [];

  for (const match of xml.matchAll(PARAGRAPH_ELEMENT)) {
    const attributes = parseAttributes(match[1]);
    const offset = Number(attributes.t) / 1000;
    if (!Number.isFinite(offset)) continue;

    const content = match[2].replace(SEGMENT_ELEMENT, '$1');
    const text = normalizeText(content);
    if (!text) continue;

    const duration = Number(attributes.d ?? 0) / 1000;
    segments.push({
      text,
      offset,
      duration: Number.isFinite(duration) ? duration : 0,
      lang,
    });
  }

  return segments;
}
