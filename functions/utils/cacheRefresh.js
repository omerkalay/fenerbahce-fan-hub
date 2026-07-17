const { buildSeasonMeta, resolveSeasonState } = require('./seasonState');

const asArray = (value) => (Array.isArray(value) ? value : []);

const createRefreshCache = ({
    existingCache = {},
    now = Date.now(),
    referenceDate = new Date(now)
} = {}) => ({
    nextMatch: existingCache.nextMatch || null,
    next3Matches: asArray(existingCache.next3Matches),
    lastFinishedMatch: existingCache.lastFinishedMatch || null,
    squad: asArray(existingCache.squad),
    lastUpdate: typeof existingCache.lastUpdate === 'number' ? existingCache.lastUpdate : null,
    lastAttempt: now,
    matchFetchStatus: 'pending',
    seasonState: existingCache.seasonState || 'unknown',
    season: buildSeasonMeta(referenceDate)
});

const applyMatchFetchSuccess = (cache, events, {
    now = Date.now(),
    referenceDate = new Date(now)
} = {}) => {
    const normalizedEvents = asArray(events);

    return {
        ...cache,
        nextMatch: normalizedEvents[0] || null,
        next3Matches: normalizedEvents.slice(0, 3),
        lastUpdate: now,
        matchFetchStatus: 'ok',
        seasonState: resolveSeasonState({
            nextMatches: normalizedEvents,
            matchFetchOk: true,
            referenceDate
        })
    };
};

const applyMatchFetchFailure = (cache) => ({
    ...cache,
    matchFetchStatus: 'error'
});

module.exports = {
    createRefreshCache,
    applyMatchFetchSuccess,
    applyMatchFetchFailure
};
