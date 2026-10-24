const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  middot: '·',
  bull: '•',
  eacute: 'é',
  egrave: 'è',
  aacute: 'á',
  agrave: 'à',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ccedil: 'ç',
};

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi;

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith('#')) {
    const codePoint =
      entity[1] === 'x' || entity[1] === 'X'
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return match;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return match;
    }
  }
  return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
}

export function decodeHtmlEntities(value: string): string {
  if (!value.includes('&')) return value;

  let current = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = current.replace(ENTITY_PATTERN, decodeEntity);
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}
