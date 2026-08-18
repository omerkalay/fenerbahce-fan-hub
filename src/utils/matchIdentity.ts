import type { LiveMatchData, MatchData } from '../types';

const TEAM_NAME_STOP_WORDS = new Set([
    'as',
    'cf',
    'club',
    'fc',
    'fk',
    'football',
    'futbol',
    'kulubu',
    'sc',
    'sk',
    'spor',
    'tc'
]);

export const normalizeMatchTeamName = (value: string | null | undefined): string => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TEAM_NAME_STOP_WORDS.has(token))
    .join(' ');

export const matchTeamNames = (
    firstName: string | null | undefined,
    secondName: string | null | undefined,
): boolean => {
    const first = normalizeMatchTeamName(firstName);
    const second = normalizeMatchTeamName(secondName);

    if (!first || !second) return false;
    if (first === second) return true;
    if (first.length >= 4 && second.length >= 4 && (first.includes(second) || second.includes(first))) {
        return true;
    }

    const firstTokens = first.split(' ');
    const secondTokens = second.split(' ');

    return firstTokens.some((firstToken) => secondTokens.some((secondToken) => {
        const shortestLength = Math.min(firstToken.length, secondToken.length);
        if (shortestLength < 4) return false;
        return firstToken === secondToken
            || firstToken.startsWith(secondToken)
            || secondToken.startsWith(firstToken);
    }));
};

const toTimestampMs = (timestamp: number | undefined): number | null => {
    const value = Number(timestamp);
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 10_000_000_000 ? value * 1000 : value;
};

export const isLiveMatchForScheduledMatch = (
    candidate: LiveMatchData | null | undefined,
    scheduledMatch: MatchData | null | undefined,
): boolean => {
    if (!candidate || !scheduledMatch || candidate.matchState === 'no-match') return false;

    const sameHomeTeam = matchTeamNames(candidate.homeTeam?.name, scheduledMatch.homeTeam?.name);
    const sameAwayTeam = matchTeamNames(candidate.awayTeam?.name, scheduledMatch.awayTeam?.name);
    if (!sameHomeTeam || !sameAwayTeam) return false;

    const candidateTime = toTimestampMs(candidate.startTimestamp);
    const scheduledTime = toTimestampMs(scheduledMatch.startTimestamp);
    if (candidateTime && scheduledTime) {
        const twelveHours = 12 * 60 * 60 * 1000;
        return Math.abs(candidateTime - scheduledTime) <= twelveHours;
    }

    return true;
};
