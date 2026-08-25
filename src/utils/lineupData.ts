import type { MatchLineups, PublishedMatchLineups, TeamLineup } from '../types';

const normalizeTeamLineup = (value: TeamLineup | null | undefined): TeamLineup | null => {
    if (!value || !Array.isArray(value.starters) || value.starters.length === 0) return null;
    return {
        ...value,
        starters: value.starters,
        bench: Array.isArray(value.bench) ? value.bench : [],
        substitutions: Array.isArray(value.substitutions) ? value.substitutions : [],
    };
};

export const normalizeMatchLineups = (value: MatchLineups | null | undefined): MatchLineups => ({
    home: normalizeTeamLineup(value?.home),
    away: normalizeTeamLineup(value?.away),
});

export const normalizePublishedLineups = (value: PublishedMatchLineups | null): PublishedMatchLineups | null => {
    if (!value || !value.matchId || !value.homeTeam || !value.awayTeam) return null;
    const lineups = normalizeMatchLineups(value.lineups);
    if (!lineups.home && !lineups.away) return null;
    return { ...value, lineups };
};
