import type { Player } from '../../types';

const DEFAULT_BACKEND_ORIGIN = 'https://us-central1-fb-hub-ed9de.cloudfunctions.net';

const normalizeBaseUrl = (value = ''): string => value.replace(/\/+$/g, '');

export const BACKEND_ORIGIN = normalizeBaseUrl(
    import.meta.env.VITE_BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN
);
export const BACKEND_URL = `${BACKEND_ORIGIN}/api`;

export const ensureAbsolutePhoto = (player: Partial<Player> = {}): string => {
    const fallbackPath = `/player-image/${player.id ?? ''}`;
    const value = player.photo || fallbackPath;

    if (value.startsWith('http://') && !value.includes('localhost')) {
        return value.replace(/^http:\/\//i, 'https://');
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${BACKEND_URL}${normalizedPath}`;
};
