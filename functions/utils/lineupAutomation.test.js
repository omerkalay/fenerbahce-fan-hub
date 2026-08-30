import { describe, expect, it } from 'vitest';

const {
    shouldPollLineups,
    normalizeCompleteLineups,
    fingerprintLineups,
    updateDetectionState
} = await import('./lineupAutomation.js');

const makeTeam = (teamId, teamName, formation = '4-2-3-1') => ({
    teamId,
    teamName,
    formation,
    starters: Array.from({ length: 11 }, (_, index) => ({
        name: `${teamName} Player ${index + 1}`,
        jersey: String(index + 1),
        position: index === 0 ? 'Goalkeeper' : 'Midfielder',
        positionGroup: index === 0 ? 'GK' : 'MID',
        formationPlace: index + 1
    })),
    bench: [],
    substitutions: []
});

describe('lineup automation', () => {
    it('polls every three minutes before the final 30-minute window', () => {
        const matchTime = 100 * 60 * 1000;
        expect(shouldPollLineups({ matchTime, now: matchTime - 91 * 60 * 1000 })).toBe(false);
        expect(shouldPollLineups({ matchTime, now: matchTime - 90 * 60 * 1000 })).toBe(true);
        expect(shouldPollLineups({ matchTime, now: matchTime - 89 * 60 * 1000 })).toBe(false);
        expect(shouldPollLineups({ matchTime, now: matchTime - 87 * 60 * 1000 })).toBe(true);
        expect(shouldPollLineups({ matchTime, now: matchTime - 30 * 60 * 1000 })).toBe(true);
        expect(shouldPollLineups({ matchTime, now: matchTime - 29 * 60 * 1000 })).toBe(true);
    });

    it('requires complete unique 11-player lineups for both teams', () => {
        const complete = { home: makeTeam('1', 'Home'), away: makeTeam('2', 'Away') };
        expect(normalizeCompleteLineups(complete)?.home.starters).toHaveLength(11);

        const incomplete = structuredClone(complete);
        incomplete.away.starters.pop();
        expect(normalizeCompleteLineups(incomplete)).toBeNull();

        const duplicate = structuredClone(complete);
        duplicate.home.starters[10].name = duplicate.home.starters[0].name;
        expect(normalizeCompleteLineups(duplicate)).toBeNull();

        const duplicateJersey = structuredClone(complete);
        duplicateJersey.home.starters[10].jersey = duplicateJersey.home.starters[0].jersey;
        expect(normalizeCompleteLineups(duplicateJersey)).toBeNull();

        const invalidName = structuredClone(complete);
        invalidName.home.starters[10].name = '11';
        expect(normalizeCompleteLineups(invalidName)).toBeNull();

        const extraInvalidPlayer = structuredClone(complete);
        extraInvalidPlayer.home.starters.push({ name: '', jersey: '12' });
        expect(normalizeCompleteLineups(extraInvalidPlayer)).toBeNull();
    });

    it('marks missing ESPN formations for visual inference', () => {
        const complete = { home: makeTeam('1', 'Home', ''), away: makeTeam('2', 'Away') };
        const normalized = normalizeCompleteLineups(complete);

        expect(normalized.home.formation).toBeNull();
        expect(normalized.home.formationSource).toBe('inferred');
        expect(normalized.away.formationSource).toBe('espn');
    });

    it('marks a lineup ready only after two identical observations', () => {
        const lineups = { home: makeTeam('1', 'Home'), away: makeTeam('2', 'Away') };
        const fingerprint = fingerprintLineups(lineups);
        const first = updateDetectionState(null, { fingerprint, payload: lineups, now: 100 });
        const second = updateDetectionState(first, { fingerprint, payload: lineups, now: 200 });
        expect(first.status).toBe('observing');
        expect(first.consecutiveSeen).toBe(1);
        expect(first.initialSeenAt).toBe(100);
        expect(first.initialReadyAt).toBeNull();
        expect(first.readyAt).toBeNull();
        expect(first.lastFingerprintChangedAt).toBeNull();
        expect(second.status).toBe('ready');
        expect(second.consecutiveSeen).toBe(2);
        expect(second.firstSeenAt).toBe(100);
        expect(second.initialSeenAt).toBe(100);
        expect(second.initialReadyAt).toBe(200);
        expect(second.readyAt).toBe(200);
    });

    it('resets stability when the starting lineup changes', () => {
        const firstLineups = { home: makeTeam('1', 'Home'), away: makeTeam('2', 'Away') };
        const changedLineups = structuredClone(firstLineups);
        changedLineups.home.starters[10].name = 'Late Replacement';
        const first = updateDetectionState(null, {
            fingerprint: fingerprintLineups(firstLineups),
            payload: firstLineups,
            now: 100
        });
        const changed = updateDetectionState(first, {
            fingerprint: fingerprintLineups(changedLineups),
            payload: changedLineups,
            now: 200
        });
        expect(changed.status).toBe('observing');
        expect(changed.consecutiveSeen).toBe(1);
        expect(changed.firstSeenAt).toBe(200);
        expect(changed.initialSeenAt).toBe(100);
        expect(changed.readyAt).toBeNull();
        expect(changed.lastFingerprintChangedAt).toBe(200);
    });

    it('keeps initial timestamps while tracking readiness for a corrected lineup version', () => {
        const original = { home: makeTeam('1', 'Home'), away: makeTeam('2', 'Away') };
        const corrected = structuredClone(original);
        corrected.away.starters[10].name = 'Corrected Starter';
        const originalFingerprint = fingerprintLineups(original);
        const correctedFingerprint = fingerprintLineups(corrected);

        const first = updateDetectionState(null, { fingerprint: originalFingerprint, payload: original, now: 100 });
        const originalReady = updateDetectionState(first, { fingerprint: originalFingerprint, payload: original, now: 200 });
        const changed = updateDetectionState(originalReady, { fingerprint: correctedFingerprint, payload: corrected, now: 300 });
        const correctedReady = updateDetectionState(changed, { fingerprint: correctedFingerprint, payload: corrected, now: 400 });

        expect(correctedReady).toMatchObject({
            status: 'ready',
            initialSeenAt: 100,
            initialReadyAt: 200,
            firstSeenAt: 300,
            readyAt: 400,
            lastFingerprintChangedAt: 300
        });
    });

    it('keeps unprovable permanent timestamps empty for a legacy ready detection record', () => {
        const lineups = { home: makeTeam('1', 'Home'), away: makeTeam('2', 'Away') };
        const fingerprint = fingerprintLineups(lineups);
        const legacy = {
            status: 'ready',
            fingerprint,
            consecutiveSeen: 12,
            firstSeenAt: 100,
            lastSeenAt: 150,
            payload: lineups
        };

        const migrated = updateDetectionState(legacy, { fingerprint, payload: lineups, now: 200 });

        expect(migrated).toMatchObject({
            status: 'ready',
            consecutiveSeen: 13,
            initialSeenAt: null,
            initialReadyAt: null,
            firstSeenAt: 100,
            readyAt: null,
            lastFingerprintChangedAt: null,
            lastSeenAt: 200
        });
    });
});
