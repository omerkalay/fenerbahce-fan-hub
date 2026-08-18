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

const normalizeTeamName = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 1 && !TEAM_NAME_STOP_WORDS.has(token))
    .join(' ');

const teamNamesMatch = (firstName, secondName) => {
    const first = normalizeTeamName(firstName);
    const second = normalizeTeamName(secondName);

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

const toTimestampMs = (match) => {
    const rawTimestamp = Number(match?.startTimestamp);
    if (Number.isFinite(rawTimestamp) && rawTimestamp > 0) {
        return rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
    }

    const rawDate = match?.date || match?.startDate;
    if (!rawDate) return null;

    const parsed = new Date(rawDate).getTime();
    return Number.isFinite(parsed) ? parsed : null;
};

const isSameMatch = (candidate, scheduledMatch) => {
    if (!candidate || !scheduledMatch) return false;

    const sameHomeTeam = teamNamesMatch(candidate.homeTeam?.name, scheduledMatch.homeTeam?.name);
    const sameAwayTeam = teamNamesMatch(candidate.awayTeam?.name, scheduledMatch.awayTeam?.name);
    if (!sameHomeTeam || !sameAwayTeam) return false;

    const candidateTime = toTimestampMs(candidate);
    const scheduledTime = toTimestampMs(scheduledMatch);
    if (candidateTime && scheduledTime) {
        const twelveHours = 12 * 60 * 60 * 1000;
        return Math.abs(candidateTime - scheduledTime) <= twelveHours;
    }

    return true;
};

module.exports = { normalizeTeamName, teamNamesMatch, isSameMatch };
