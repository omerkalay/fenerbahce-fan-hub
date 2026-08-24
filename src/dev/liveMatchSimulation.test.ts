import { describe, expect, it } from 'vitest';
import { buildDevLiveSimulation, DEV_LIVE_SCENARIOS, resolveDevLiveScenario } from './liveMatchSimulation';

describe('development live match simulation', () => {
    it('ignores every mock query when development mode is disabled', () => {
        for (const scenario of DEV_LIVE_SCENARIOS) {
            expect(resolveDevLiveScenario(`?mockLive=${scenario}`, false)).toBeNull();
        }
    });

    it('accepts only supported scenarios in development mode', () => {
        expect(resolveDevLiveScenario('?mockLive=pre-match', true)).toBe('pre-match');
        expect(resolveDevLiveScenario('?mockLive=second-half', true)).toBe('second-half');
        expect(resolveDevLiveScenario('?mockLive=unknown', true)).toBeNull();
        expect(resolveDevLiveScenario('', true)).toBeNull();
    });

    it('builds isolated countdown and pre-match transition states', () => {
        const countdown = buildDevLiveSimulation('countdown');
        const preMatch = buildDevLiveSimulation('pre-match');

        expect(countdown.liveMatchState).toBe('countdown');
        expect(preMatch.liveMatchState).toBe('pre');
        expect(countdown.matchData.startTimestamp).toBeGreaterThan(Math.floor(Date.now() / 1000));
        expect(preMatch.startingXI).toBeNull();
    });

    it('builds stoppage time with existing live match contracts', () => {
        const simulation = buildDevLiveSimulation('stoppage');

        expect(simulation.liveMatchState).toBe('in');
        expect(simulation.liveMatchData.displayClock).toBe("90+4'");
        expect(simulation.liveMatchData.events?.some((event) => event.type?.includes('VAR'))).toBe(true);
        expect(simulation.liveMatchData.lineups?.home?.starters).toHaveLength(11);
        expect(simulation.liveMatchData.lineups?.away?.starters).toHaveLength(11);
    });

    it('keeps the published starting XI free from future live substitutions', () => {
        const firstHalf = buildDevLiveSimulation('first-half');
        const secondHalf = buildDevLiveSimulation('second-half');

        expect(firstHalf.startingXI?.lineups.home?.substitutions).toHaveLength(0);
        expect(firstHalf.startingXI?.lineups.away?.substitutions).toHaveLength(0);
        expect(firstHalf.liveMatchData.lineups?.home?.substitutions).toHaveLength(0);
        expect(secondHalf.startingXI?.lineups.home?.substitutions).toHaveLength(0);
        expect(secondHalf.liveMatchData.lineups?.home?.substitutions).toHaveLength(1);
        expect(secondHalf.liveMatchData.lineups?.away?.substitutions).toHaveLength(1);
    });

    it('keeps partial data valid without inventing the missing opponent lineup', () => {
        const simulation = buildDevLiveSimulation('partial-data');

        expect(simulation.liveMatchData.stats).toHaveLength(1);
        expect(simulation.liveMatchData.lineups?.home?.starters).toHaveLength(11);
        expect(simulation.liveMatchData.lineups?.away).toBeNull();
    });
});
