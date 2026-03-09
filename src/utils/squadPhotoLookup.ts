import { localizePlayerName } from './playerDisplay';
import type { Player } from '../types';

const stripDiacritics = (value: string): string =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const normalizeLookupKey = (value: string): string =>
    stripDiacritics(localizePlayerName(String(value || '')).trim().toLocaleLowerCase('tr-TR'))
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizeRawLookupKey = (value: string): string =>
    stripDiacritics(String(value || '').trim().toLocaleLowerCase('tr-TR'))
        .replace(/[^\p{L}\p{N} ]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getLookupTokens = (value: string): string[] =>
    normalizeLookupKey(value)
        .split(' ')
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

const getRawLookupTokens = (value: string): string[] =>
    normalizeRawLookupKey(value)
        .split(' ')
        .map((part) => part.trim())
        .filter((part) => part.length >= 3);

export interface SquadPhotoMaps {
    byJersey: Record<string, string>;
    byName: Record<string, string>;
    byAlias: Record<string, string>;
}

export function buildSquadPhotoMaps(squad: Player[]): SquadPhotoMaps {
    const byJersey = squad.reduce<Record<string, string>>((acc, player) => {
        if (player.number != null && player.photo) {
            acc[String(player.number)] = player.photo;
        }
        return acc;
    }, {});

    const byName = squad.reduce<Record<string, string>>((acc, player) => {
        if (player.name && player.photo) {
            acc[normalizeLookupKey(player.name)] = player.photo;
        }
        return acc;
    }, {});

    const aliasCounts = squad.reduce<Record<string, number>>((acc, player) => {
        if (!player.name || !player.photo) return acc;
        const seen = new Set<string>();
        getLookupTokens(player.name).forEach((token) => {
            if (seen.has(token)) return;
            seen.add(token);
            acc[token] = (acc[token] || 0) + 1;
        });
        return acc;
    }, {});

    const byAlias = squad.reduce<Record<string, string>>((acc, player) => {
        if (!player.name || !player.photo) return acc;
        const seen = new Set<string>();
        getLookupTokens(player.name).forEach((token) => {
            if (seen.has(token) || aliasCounts[token] !== 1) return;
            seen.add(token);
            acc[token] = player.photo!;
        });
        return acc;
    }, {});

    return { byJersey, byName, byAlias };
}

export function findPlayerPhoto(
    name: string,
    jersey: string | number | null | undefined,
    maps: SquadPhotoMaps
): string | null {
    if (jersey != null && maps.byJersey[String(jersey)]) {
        return maps.byJersey[String(jersey)];
    }

    const exactKey = normalizeLookupKey(name);
    if (exactKey && maps.byName[exactKey]) {
        return maps.byName[exactKey];
    }

    const rawExactKey = normalizeRawLookupKey(name);
    if (rawExactKey && maps.byName[rawExactKey]) {
        return maps.byName[rawExactKey];
    }

    const tokens = getLookupTokens(name).sort((a, b) => b.length - a.length);
    for (const token of tokens) {
        if (maps.byAlias[token]) return maps.byAlias[token];
    }

    const rawTokens = getRawLookupTokens(name).sort((a, b) => b.length - a.length);
    for (const token of rawTokens) {
        if (maps.byAlias[token]) return maps.byAlias[token];
    }

    return null;
}
