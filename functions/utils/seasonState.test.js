import { describe, expect, it } from 'vitest';
import seasonState from './seasonState.js';

const {
    buildSeasonMeta,
    resolveLegacySeasonState,
    resolveSeasonState
} = seasonState;

describe('seasonState', () => {
    it('marks the season active when upcoming matches exist', () => {
        expect(resolveSeasonState({
            nextMatches: [{ id: 1 }],
            matchFetchOk: true,
            referenceDate: new Date('2026-05-18T12:00:00Z')
        })).toBe('active');
    });

    it('does not mark offseason when the match fetch failed', () => {
        expect(resolveSeasonState({
            nextMatches: [],
            matchFetchOk: false,
            referenceDate: new Date('2026-05-18T12:00:00Z')
        })).toBe('unknown');
    });

    it('does not mark offseason during the regular season just because there is no next match', () => {
        expect(resolveSeasonState({
            nextMatches: [],
            matchFetchOk: true,
            referenceDate: new Date('2026-02-01T12:00:00Z')
        })).toBe('unknown');
    });

    it('marks offseason only in the conservative season break window', () => {
        expect(resolveSeasonState({
            nextMatches: [],
            matchFetchOk: true,
            referenceDate: new Date('2026-05-18T12:00:00Z')
        })).toBe('offseason');
    });

    it('uses the same guarded window for legacy cache fallback', () => {
        expect(resolveLegacySeasonState({
            nextMatch: null,
            nextMatches: [],
            referenceDate: new Date('2026-02-01T12:00:00Z')
        })).toBe('unknown');
    });

    it('formats season metadata from the start year', () => {
        expect(buildSeasonMeta(new Date('2026-05-18T12:00:00Z'))).toEqual({
            startYear: 2025,
            label: '2025/26'
        });
    });
});
