import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../src/entities';

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('&amp; &lt; &gt; &quot; &apos;')).toBe('& < > " \'');
  });

  it('decodes decimal entities', () => {
    expect(decodeHtmlEntities('adi&#243;s &#39;ok&#39;')).toBe('adiós \'ok\'');
  });

  it('decodes hexadecimal entities', () => {
    expect(decodeHtmlEntities('&#x27;hi&#x27; &#x1F600;')).toBe("'hi' 😀");
  });

  it('decodes double encoded entities', () => {
    expect(decodeHtmlEntities('&amp;#39;quoted&amp;#39;')).toBe("'quoted'");
    expect(decodeHtmlEntities('&amp;amp;')).toBe('&');
  });

  it('keeps unknown entities untouched', () => {
    expect(decodeHtmlEntities('&unknown; &fake123;')).toBe('&unknown; &fake123;');
  });

  it('keeps invalid code points untouched', () => {
    expect(decodeHtmlEntities('&#0; &#x110000;')).toBe('&#0; &#x110000;');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('texto normal')).toBe('texto normal');
    expect(decodeHtmlEntities('')).toBe('');
  });
});
