import { describe, it, expect } from 'vitest';
import {
  encodeResults, decodeResults, sanitizeName, parseGameParams, buildShareUrl,
  rankForScore, emojiBar, buildShareText, formatPoints, makePlayer,
  encodeField, decodeField, addToField, standings, ordinal, MAX_FIELD,
} from '../src/lib/share';

describe('formatPoints', () => {
  it('groups thousands with commas', () => {
    expect(formatPoints(18240)).toBe('18,240');
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(25000)).toBe('25,000');
  });
});

describe('result encoding', () => {
  it('round-trips five scores', () => {
    const scores = [5000, 0, 1250, 4999, 320];
    expect(decodeResults(encodeResults(scores))).toEqual(scores);
  });
  it('encodes to exactly 15 base36 chars', () => {
    expect(encodeResults([0, 0, 0, 0, 0])).toMatch(/^[0-9a-z]{15}$/);
  });
  it.each(['', 'short', '!'.repeat(15)])('rejects malformed %j', (s) => {
    expect(decodeResults(s)).toBeNull();
  });
  it('rejects scores above 5000', () => {
    // 'zzz' base36 = 46655 > 5000
    expect(decodeResults('zzz' + '000'.repeat(4))).toBeNull();
  });
});

describe('sanitizeName', () => {
  it('trims and caps at 20 chars', () => {
    expect(sanitizeName('  ' + 'a'.repeat(30))).toBe('a'.repeat(20));
  });
  it('strips markup, quotes and the field separator', () => {
    expect(sanitizeName('<b>K&"a\'p~x</b>')).toBe('bKapxb');
  });
  it('collapses runs of whitespace', () => {
    expect(sanitizeName('Kapil   Das')).toBe('Kapil Das');
  });
});

describe('makePlayer', () => {
  it('totals the scores', () => {
    expect(makePlayer('Kapil', [1000, 2000, 3000, 4000, 5000])).toEqual({
      name: 'Kapil', scores: [1000, 2000, 3000, 4000, 5000], total: 15000,
    });
  });
  it('sanitizes the name and keeps an empty one null', () => {
    expect(makePlayer('<Ana>', [0, 0, 0, 0, 0]).name).toBe('Ana');
    expect(makePlayer('!!!', [0, 0, 0, 0, 0]).name).toBeNull();
  });
});

describe('field encoding', () => {
  const kapil = makePlayer('Kapil', [1000, 1000, 1000, 1000, 1000]);
  const ana = makePlayer('Ana', [2000, 2000, 2000, 2000, 2000]);

  it('round-trips a multi-player field', () => {
    expect(decodeField(encodeField([kapil, ana]))).toEqual([kapil, ana]);
  });
  it('round-trips a nameless player', () => {
    const anon = makePlayer(null, [500, 500, 500, 500, 500]);
    expect(decodeField(encodeField([anon]))).toEqual([anon]);
  });
  it('drops entries with unreadable scores but keeps the rest', () => {
    expect(decodeField(encodeField([kapil]) + '~garbage')).toEqual([kapil]);
  });
  it('returns an empty field for nonsense', () => {
    expect(decodeField('nonsense')).toEqual([]);
    expect(decodeField('')).toEqual([]);
  });
  it('caps a decoded field at MAX_FIELD players', () => {
    const many = Array.from({ length: MAX_FIELD + 4 }, (_, i) =>
      makePlayer(`P${i}`, [i, 0, 0, 0, 0]));
    expect(decodeField(encodeField(many))).toHaveLength(MAX_FIELD);
  });
});

describe('addToField', () => {
  const kapil = makePlayer('Kapil', [1000, 1000, 1000, 1000, 1000]); // 5000
  const ana = makePlayer('Ana', [2000, 2000, 2000, 2000, 2000]);     // 10000

  it('appends a new player and sorts by total, highest first', () => {
    expect(addToField([kapil], ana).map((p) => p.name)).toEqual(['Ana', 'Kapil']);
  });
  it('replaces a returning player rather than duplicating them', () => {
    const kapilAgain = makePlayer('Kapil', [5000, 5000, 5000, 5000, 5000]);
    const out = addToField([kapil, ana], kapilAgain);
    expect(out.map((p) => p.name)).toEqual(['Kapil', 'Ana']);
    expect(out[0].total).toBe(25000);
  });
  it('matches a returning player case-insensitively and keeps the incoming data', () => {
    const kapilAgain = makePlayer('KAPIL', [3000, 3000, 3000, 3000, 3000]);
    const out = addToField([kapil], kapilAgain);
    expect(out).toHaveLength(1);
    expect(out[0].total).toBe(15000);
    expect(out[0].name).toBe('KAPIL');
  });
  it('keeps nameless players distinct', () => {
    const anon = makePlayer(null, [0, 0, 0, 0, 0]);
    expect(addToField([anon], makePlayer(null, [1, 0, 0, 0, 0]))).toHaveLength(2);
  });
  it('drops the lowest scorer once the board is full', () => {
    const full = Array.from({ length: MAX_FIELD }, (_, i) =>
      makePlayer(`P${i}`, [1000 + i, 0, 0, 0, 0]));
    const out = addToField(full, makePlayer('Winner', [5000, 5000, 5000, 5000, 5000]));
    expect(out).toHaveLength(MAX_FIELD);
    expect(out[0].name).toBe('Winner');
    expect(out.map((p) => p.name)).not.toContain('P0'); // lowest total
  });
  it('keeps a new lowest-scoring player on the board, dropping the previous lowest instead', () => {
    const full = Array.from({ length: MAX_FIELD }, (_, i) =>
      makePlayer(`P${i}`, [1000 + i, 0, 0, 0, 0])); // P0=1000 (lowest) .. P7=1007 (highest)
    const me = makePlayer('Me', [0, 0, 0, 0, 0]); // lower than everyone already on the board
    const out = addToField(full, me);
    expect(out).toHaveLength(MAX_FIELD);
    expect(out.map((p) => p.name)).toContain('Me');
    expect(out.map((p) => p.name)).not.toContain('P0'); // was the previous lowest scorer
  });
});

describe('standings', () => {
  it('numbers players from 1, highest total first', () => {
    const a = makePlayer('A', [1000, 0, 0, 0, 0]);
    const b = makePlayer('B', [3000, 0, 0, 0, 0]);
    expect(standings([a, b])).toEqual([
      { position: 1, player: b },
      { position: 2, player: a },
    ]);
  });
});

describe('ordinal', () => {
  it.each([[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [21, '21st']])(
    '%d → %s', (n, s) => expect(ordinal(n)).toBe(s));
});

describe('parseGameParams', () => {
  it('parses a code and a full field', () => {
    const field = [makePlayer('Kapil', [1000, 2000, 3000, 4000, 5000])];
    const { code, field: parsed } = parseGameParams(`?c=5.1&p=${encodeField(field)}`);
    expect(code).toEqual({ seed: 5, poolVersion: 1 });
    expect(parsed).toEqual(field);
  });
  it('drops the field on malformed p but keeps the code', () => {
    const { code, field } = parseGameParams('?c=5.1&p=nonsense');
    expect(code).toEqual({ seed: 5, poolVersion: 1 });
    expect(field).toEqual([]);
  });
  it('returns an empty field for an empty query', () => {
    expect(parseGameParams('')).toEqual({ code: null, field: [] });
  });
});

describe('buildShareUrl', () => {
  it('builds a URL that parses back to the same field', () => {
    const field = [makePlayer('Kapil', [1, 2, 3, 4, 5]), makePlayer('Ana', [9, 9, 9, 9, 9])];
    const url = buildShareUrl('https://x.test/', { seed: 9, poolVersion: 2 }, field);
    const parsed = parseGameParams(new URL(url).search);
    expect(parsed.code).toEqual({ seed: 9, poolVersion: 2 });
    expect(parsed.field).toEqual(field);
  });
  it('survives a name containing a space', () => {
    const field = [makePlayer('Kapil Das', [1, 2, 3, 4, 5])];
    const url = buildShareUrl('https://x.test/', { seed: 1, poolVersion: 1 }, field);
    expect(parseGameParams(new URL(url).search).field[0].name).toBe('Kapil Das');
  });
});

describe('rankForScore', () => {
  it.each([
    [0, 'Confused Tourist'], [6000, 'Confused Tourist'],
    [6001, 'Beach Regular'], [12000, 'Beach Regular'],
    [12001, 'Susegad Local'], [18000, 'Susegad Local'],
    [18001, 'Poder of the Village'], [23000, 'Poder of the Village'],
    [23001, 'True Goenkar'], [25000, 'True Goenkar'],
  ])('%d → %s', (score, rank) => expect(rankForScore(score)).toBe(rank));
});

describe('emojiBar & share text', () => {
  it('maps distances to the emoji story', () => {
    expect(emojiBar([50, 500, 3000, 9000, 101])).toBe('🎯🟢🟡🔴🟢');
  });
  it('invites the next player when others are on the board', () => {
    expect(
      buildShareText({
        rank: 'Susegad Local', bar: '🎯🟢🔴🟢🟡', total: 18240,
        url: 'https://x.test/?c=a.1', position: 2, fieldSize: 4,
      })
    ).toBe(
      'Backyard: Goa 🏖️ — Susegad Local\n' +
      '🎯🟢🔴🟢🟡 18,240 / 25,000\n' +
      '2nd of 4 on the board\n' +
      'Add yours: https://x.test/?c=a.1'
    );
  });
  it('challenges directly when the board is empty', () => {
    expect(
      buildShareText({
        rank: 'True Goenkar', bar: '🎯🎯🎯🎯🎯', total: 25000,
        url: 'https://x.test/?c=a.1', position: 1, fieldSize: 1,
      })
    ).toBe(
      'Backyard: Goa 🏖️ — True Goenkar\n' +
      '🎯🎯🎯🎯🎯 25,000 / 25,000\n' +
      'Beat me: https://x.test/?c=a.1'
    );
  });
});
