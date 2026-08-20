const TURKEY_CUP_UNIQUE_TOURNAMENT_ID = 96;
const TURKEY_CUP_COVERAGE_START_YEAR = 2026;

const asArray = (value) => (Array.isArray(value) ? value : []);

const getTournament = (match) => (
    match?.tournament?.uniqueTournament
    || match?.tournament
    || null
);

const getTournamentName = (match) => String(getTournament(match)?.name || '').trim();

const normalizeTournamentName = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('en-US');

const isTurkeyCupMatch = (match) => {
    const tournament = getTournament(match);
    const tournamentId = Number(tournament?.id);
    if (tournamentId === TURKEY_CUP_UNIQUE_TOURNAMENT_ID) return true;

    const normalizedName = normalizeTournamentName(getTournamentName(match));
    return /\b(turkiye kupasi|turkish cup|turkey cup)\b/.test(normalizedName);
};

const getSeasonStartYearForTimestamp = (startTimestamp) => {
    const numericTimestamp = Number(startTimestamp);
    if (!Number.isFinite(numericTimestamp)) return null;

    const date = new Date(numericTimestamp * 1000);
    if (!Number.isFinite(date.getTime())) return null;

    const month = date.getUTCMonth();
    const year = date.getUTCFullYear();
    return month >= 6 ? year : year - 1;
};

const isMatchInSeason = (match, seasonStartYear) => (
    getSeasonStartYearForTimestamp(match?.startTimestamp) === Number(seasonStartYear)
);

const getMatchTimestamp = (match) => {
    const timestamp = Number(match?.startTimestamp);
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

const sortMatchesChronologically = (matches) => asArray(matches)
    .filter((match) => match && typeof match === 'object')
    .slice()
    .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));

const mergeCupFixtureMatches = (existingMatches, incomingEvents, seasonStartYear) => {
    const byId = new Map();

    for (const match of asArray(existingMatches)) {
        if (!match?.id || !isTurkeyCupMatch(match) || !isMatchInSeason(match, seasonStartYear)) continue;
        byId.set(String(match.id), match);
    }

    for (const match of asArray(incomingEvents)) {
        if (!match?.id || !isTurkeyCupMatch(match) || !isMatchInSeason(match, seasonStartYear)) continue;
        byId.set(String(match.id), match);
    }

    return sortMatchesChronologically(Array.from(byId.values()));
};

const isMatchCompleted = (match) => {
    const status = match?.status || {};
    const statusType = String(status.type || '').toLowerCase();
    const statusDescription = String(status.description || '').toLowerCase();
    const statusCode = Number(status.code);

    return statusType === 'finished'
        || statusType === 'post'
        || statusCode === 100
        || /finished|full time|after extra time|after penalties/.test(statusDescription);
};

const shouldFetchCupResults = (matches, now = Date.now()) => asArray(matches).some((match) => {
    if (isMatchCompleted(match)) return false;
    const startMs = Number(match?.startTimestamp) * 1000;
    return Number.isFinite(startMs) && startMs <= now;
});

const mergeCupFixturesIntoCache = (cache, incomingEvents, {
    seasonStartYear,
    now = Date.now()
} = {}) => {
    const normalizedSeasonStartYear = Number(seasonStartYear);
    if (!Number.isInteger(normalizedSeasonStartYear)) return cache;
    if (normalizedSeasonStartYear < TURKEY_CUP_COVERAGE_START_YEAR) return cache;

    const existingCupFixtures = cache?.cupFixtures && typeof cache.cupFixtures === 'object'
        ? cache.cupFixtures
        : {};
    const existingPayload = existingCupFixtures[normalizedSeasonStartYear] || {};
    const matches = mergeCupFixtureMatches(
        existingPayload.matches,
        incomingEvents,
        normalizedSeasonStartYear
    );

    return {
        ...cache,
        cupFixtures: {
            ...existingCupFixtures,
            [normalizedSeasonStartYear]: {
                source: 'SofaScore',
                seasonStartYear: normalizedSeasonStartYear,
                lastUpdate: now,
                matches
            }
        }
    };
};

module.exports = {
    TURKEY_CUP_UNIQUE_TOURNAMENT_ID,
    TURKEY_CUP_COVERAGE_START_YEAR,
    getSeasonStartYearForTimestamp,
    isTurkeyCupMatch,
    isMatchCompleted,
    sortMatchesChronologically,
    mergeCupFixtureMatches,
    mergeCupFixturesIntoCache,
    shouldFetchCupResults
};
