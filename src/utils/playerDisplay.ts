const PLAYER_NAME_OVERRIDES: Record<string, string> = {
    'munir mercan': 'Levent Mercan'
};

const normalizePlayerKey = (value = ''): string =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

export const localizePlayerName = (name = ''): string => {
    const raw = String(name || '').trim();
    if (!raw) return raw;

    return PLAYER_NAME_OVERRIDES[normalizePlayerKey(raw)] || raw;
};

