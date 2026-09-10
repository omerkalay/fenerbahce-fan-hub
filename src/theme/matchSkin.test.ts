import { describe, expect, it } from 'vitest';
import { isChampionsLeagueMatch, resolveMatchSkin } from './matchSkin';
import type { MatchData } from '../types';

const buildMatch = (tournamentName: string, uniqueName?: string): MatchData => ({
    id: 1,
    startTimestamp: 1_760_000_000,
    homeTeam: { id: 3052, name: 'Fenerbahçe' },
    awayTeam: { id: 1649, name: 'Olympique Lyonnais' },
    tournament: {
        name: tournamentName,
        ...(uniqueName ? { uniqueTournament: { name: uniqueName } } : {}),
    },
} as MatchData);

describe('isChampionsLeagueMatch', () => {
    it('matches the English competition name', () => {
        expect(isChampionsLeagueMatch(buildMatch('UEFA Champions League'))).toBe(true);
    });

    it('matches the localized name, with or without diacritics', () => {
        expect(isChampionsLeagueMatch(buildMatch('UEFA Şampiyonlar Ligi'))).toBe(true);
        expect(isChampionsLeagueMatch(buildMatch('UEFA Sampiyonlar Ligi'))).toBe(true);
    });

    it('prefers uniqueTournament but falls back to the tournament name', () => {
        expect(isChampionsLeagueMatch(buildMatch('Grup Maçı', 'UEFA Champions League'))).toBe(true);
        expect(isChampionsLeagueMatch(buildMatch('UEFA Champions League', 'Grup Maçı'))).toBe(true);
    });

    it('rejects other competitions and missing matches', () => {
        expect(isChampionsLeagueMatch(buildMatch('UEFA Europa League'))).toBe(false);
        expect(isChampionsLeagueMatch(buildMatch('Trendyol Süper Lig'))).toBe(false);
        expect(isChampionsLeagueMatch(null)).toBe(false);
    });
});

describe('resolveMatchSkin', () => {
    it('turns on the night skin for a Champions League match in the classic theme', () => {
        expect(resolveMatchSkin(buildMatch('UEFA Champions League'), 'classic')).toBe('ucl-night');
    });

    it('leaves the white-kit theme untouched', () => {
        expect(resolveMatchSkin(buildMatch('UEFA Champions League'), 'white-kit')).toBe('default');
    });

    it('stays default for any other fixture', () => {
        expect(resolveMatchSkin(buildMatch('Trendyol Süper Lig'), 'classic')).toBe('default');
        expect(resolveMatchSkin(null, 'classic')).toBe('default');
    });
});
