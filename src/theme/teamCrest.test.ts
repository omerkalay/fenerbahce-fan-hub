import {
  FENERBAHCE_ANNIVERSARY_CREST_URL,
  isFenerbahceTeamName,
  resolveTeamCrest,
} from './teamCrest';

describe('team crest theming', () => {
  it.each(['Fenerbahçe', 'Fenerbahce', 'FENERBAHÇE SK'])(
    'recognizes %s as Fenerbahçe',
    (name) => {
      expect(isFenerbahceTeamName(name)).toBe(true);
    },
  );

  it('uses the anniversary crest for Fenerbahçe in white-kit theme', () => {
    expect(resolveTeamCrest({
      theme: 'white-kit',
      defaultSrc: 'https://example.com/classic.png',
      teamName: 'Fenerbahçe',
    })).toBe(FENERBAHCE_ANNIVERSARY_CREST_URL);
  });

  it('keeps the classic crest in classic theme', () => {
    expect(resolveTeamCrest({
      theme: 'classic',
      defaultSrc: 'https://example.com/classic.png',
      teamName: 'Fenerbahçe',
    })).toBe('https://example.com/classic.png');
  });

  it('does not replace an opponent crest', () => {
    expect(resolveTeamCrest({
      theme: 'white-kit',
      defaultSrc: 'https://example.com/opponent.png',
      teamName: 'Beşiktaş',
    })).toBe('https://example.com/opponent.png');
  });

  it('can replace an explicitly identified Fenerbahçe crest without a name or source', () => {
    expect(resolveTeamCrest({
      theme: 'white-kit',
      isFenerbahce: true,
    })).toBe(FENERBAHCE_ANNIVERSARY_CREST_URL);
  });
});
