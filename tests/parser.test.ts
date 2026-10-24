import { describe, expect, it } from 'vitest';
import { parseTimedText, parseJson3 } from '../src/parser';
import { JSON3_PAYLOAD, SRV1_XML, SRV3_SEGMENTS_XML, SRV3_XML } from './helpers';

describe('parseTimedText', () => {
  it('parses srv3 paragraphs and decodes entities', () => {
    expect(parseTimedText(SRV3_XML, 'en')).toEqual([
      { text: 'All right, so here we are', offset: 1.2, duration: 2.16, lang: 'en' },
      { text: "and that's cool & fine", offset: 5.318, duration: 2.656, lang: 'en' },
    ]);
  });

  it('joins srv3 segments without adding spaces', () => {
    expect(parseTimedText(SRV3_SEGMENTS_XML, 'ko')).toEqual([
      { text: '오반 강남 스타일', offset: 9.96, duration: 3.92, lang: 'ko' },
      { text: '강남 스타일', offset: 14.04, duration: 3.479, lang: 'ko' },
    ]);
  });

  it('parses srv1 text elements', () => {
    expect(parseTimedText(SRV1_XML, 'es')).toEqual([
      { text: 'Hola & adiós', offset: 0, duration: 1.5, lang: 'es' },
      { text: 'Second line with break', offset: 1.5, duration: 2, lang: 'es' },
    ]);
  });

  it('sorts segments by offset', () => {
    const xml = '<body><p t="2000" d="1000">b</p><p t="1000" d="1000">a</p></body>';
    expect(parseTimedText(xml).map((segment) => segment.text)).toEqual(['a', 'b']);
  });

  it('ignores empty paragraphs and paragraphs without timing', () => {
    const xml =
      '<body><p t="14030" w="1" a="1">\n</p><p w="1">texto</p><p t="100" d="50">ok</p></body>';
    expect(parseTimedText(xml)).toEqual([
      { text: 'ok', offset: 0.1, duration: 0.05, lang: undefined },
    ]);
  });

  it('uses a zero duration when the attribute is missing', () => {
    const xml = '<body><p t="500">sin duracion</p></body>';
    expect(parseTimedText(xml, 'es')).toEqual([
      { text: 'sin duracion', offset: 0.5, duration: 0, lang: 'es' },
    ]);
  });

  it('strips inline markup', () => {
    const xml = '<body><p t="0" d="1000"><i>italic</i> plain</p></body>';
    expect(parseTimedText(xml)[0].text).toBe('italic plain');
  });

  it('collapses whitespace and newlines', () => {
    const xml = '<body><p t="0" d="1000">line one\n   line two</p></body>';
    expect(parseTimedText(xml)[0].text).toBe('line one line two');
  });

  it('returns an empty list for empty input', () => {
    expect(parseTimedText('')).toEqual([]);
    expect(parseTimedText('   ')).toEqual([]);
    expect(parseTimedText('<timedtext></timedtext>')).toEqual([]);
  });
});

describe('parseJson3', () => {
  it('parses events and skips whitespace-only ones', () => {
    expect(parseJson3(JSON3_PAYLOAD, 'es')).toEqual([
      { text: 'Hola mundo', offset: 0, duration: 1.5, lang: 'es' },
      { text: 'linea dos', offset: 2, duration: 1, lang: 'es' },
    ]);
  });

  it('returns an empty list for unexpected payloads', () => {
    expect(parseJson3(null)).toEqual([]);
    expect(parseJson3({})).toEqual([]);
    expect(parseJson3({ events: [] })).toEqual([]);
    expect(parseJson3({ events: [{ tStartMs: 0 }] })).toEqual([]);
  });
});
