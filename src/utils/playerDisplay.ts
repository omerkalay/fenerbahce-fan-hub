const PLAYER_NAME_OVERRIDES: Record<string, string> = {
    'munir mercan': 'Levent Mercan',
    'oguz aydin': 'O\u011fuz Ayd\u0131n',
    'ismail yuksek': '\u0130smail Y\u00fcksek',
    'yigit demir': 'Yi\u011fit Efe Demir',
    'kerem akturkoglu': 'Kerem Akt\u00fcrko\u011flu',
    'matteo guendouzi': 'Matt\u00e9o Guendouzi',
    'milan skriniar': 'Milan \u0160kriniar',
    'nelson semedo': 'N\u00e9lson Semedo',
    'caglar soyyuncu': '\u00c7a\u011flar S\u00f6y\u00fcnc\u00fc',
    'dorgeles nene': 'Dorgeles Nene',
    'nene dorgeles': 'Dorgeles Nene',
    'tarik cetin': 'Tar\u0131k \u00c7etin',
    'cherif': 'Sidiki Cherif'
};

const normalizePlayerKey = (value = ''): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const decodeUnicodeEscapes = (value: string): string =>
    value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

export const localizePlayerName = (name = ''): string => {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    const localized = PLAYER_NAME_OVERRIDES[normalizePlayerKey(raw)] || raw;
    return decodeUnicodeEscapes(localized);
};
