const { db } = require('../config');
const { fetchEspnSummaryForMatch, MATCH_SUMMARY_SCHEMA_VERSION } = require('../services/espn');
const { buildSeasonMeta, getSeasonStartYear, resolveLegacySeasonState } = require('../utils/seasonState');
const { isSameMatch } = require('../utils/matchIdentity');
const {
    TURKEY_CUP_COVERAGE_START_YEAR,
    isTurkeyCupMatch
} = require('../utils/cupFixtures');
const {
    refreshUefaJourneyCache,
    readUefaJourneyCache,
    buildUefaSummary
} = require('../services/uefaJourney');

const UEFA_CACHE_MAX_AGE_MS = 36 * 60 * 60 * 1000;
const uefaRefreshes = new Map();

async function handleNextMatch(req, res) {
    const snapshot = await db.ref('cache/nextMatch').once('value');
    const data = snapshot.val();
    if (!data) {
        return res.status(404).json({ error: 'No match data. Run /refresh first.' });
    }
    return res.json(data);
}

async function handleNext3Matches(req, res) {
    const snapshot = await db.ref('cache/next3Matches').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleMatchStatus(req, res) {
    const [
        nextMatchSnapshot,
        next3MatchesSnapshot,
        seasonStateSnapshot,
        seasonSnapshot,
        matchFetchStatusSnapshot,
        lastUpdateSnapshot
    ] = await Promise.all([
        db.ref('cache/nextMatch').once('value'),
        db.ref('cache/next3Matches').once('value'),
        db.ref('cache/seasonState').once('value'),
        db.ref('cache/season').once('value'),
        db.ref('cache/matchFetchStatus').once('value'),
        db.ref('cache/lastUpdate').once('value')
    ]);
    const nextMatch = nextMatchSnapshot.val() || null;
    const next3MatchesValue = next3MatchesSnapshot.val();
    const next3Matches = Array.isArray(next3MatchesValue) ? next3MatchesValue : [];
    const referenceDate = new Date();
    const seasonState = seasonStateSnapshot.val() || resolveLegacySeasonState({
        nextMatch,
        nextMatches: next3Matches,
        referenceDate
    });

    return res.json({
        nextMatch,
        next3Matches,
        seasonState,
        season: seasonSnapshot.val() || buildSeasonMeta(referenceDate),
        matchFetchStatus: matchFetchStatusSnapshot.val() || null,
        lastUpdate: lastUpdateSnapshot.val() || null
    });
}

async function handleCupFixtures(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const seasonStartYear = Number(req.query?.seasonStartYear);
    if (!Number.isInteger(seasonStartYear) || seasonStartYear < 2000 || seasonStartYear > 2100) {
        return res.status(400).json({ error: 'Valid seasonStartYear required' });
    }

    if (seasonStartYear < TURKEY_CUP_COVERAGE_START_YEAR) {
        return res.json({
            source: 'SofaScore',
            seasonStartYear,
            lastUpdate: null,
            matches: []
        });
    }

    const snapshot = await db.ref(`cache/cupFixtures/${seasonStartYear}`).once('value');
    const payload = snapshot.val() || {};
    return res.json({
        source: 'SofaScore',
        seasonStartYear,
        lastUpdate: typeof payload.lastUpdate === 'number' ? payload.lastUpdate : null,
        matches: Array.isArray(payload.matches) ? payload.matches : []
    });
}

const refreshUefaJourneyOnce = (seasonStartYear) => {
    const key = String(seasonStartYear);
    if (!uefaRefreshes.has(key)) {
        const refresh = refreshUefaJourneyCache(seasonStartYear)
            .finally(() => uefaRefreshes.delete(key));
        uefaRefreshes.set(key, refresh);
    }
    return uefaRefreshes.get(key);
};

const createUefaJourneyHandler = ({
    readCache = readUefaJourneyCache,
    refreshCache = refreshUefaJourneyOnce,
    summarize = buildUefaSummary,
    now = () => Date.now()
} = {}) => async function uefaJourneyHandler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const seasonStartYear = Number(req.query?.seasonStartYear);
    if (!Number.isInteger(seasonStartYear) || seasonStartYear < 2000 || seasonStartYear > 2100) {
        return res.status(400).json({ error: 'Valid seasonStartYear required' });
    }

    const summaryOnly = String(req.query?.summary || '').toLowerCase() === 'true';
    const requestTime = now();
    const currentSeasonStartYear = getSeasonStartYear(new Date(requestTime));
    let cached = await readCache(seasonStartYear);
    const cacheAge = cached?.lastUpdate ? requestTime - Number(cached.lastUpdate) : Infinity;
    const shouldRefresh = !cached
        || (seasonStartYear === currentSeasonStartYear && cacheAge > UEFA_CACHE_MAX_AGE_MS);

    if (shouldRefresh) {
        try {
            cached = await refreshCache(seasonStartYear);
        } catch (error) {
            console.error(`UEFA journey refresh failed for ${seasonStartYear}:`, error.message);
            if (!cached) {
                return res.status(502).json({ error: 'UEFA journey data unavailable' });
            }
            cached = { ...cached, stale: true };
        }
    }

    if (summaryOnly) {
        return res.json(summarize(cached));
    }

    return res.json(cached);
};

const handleUefaJourney = createUefaJourneyHandler();

async function handleStandings(req, res) {
    const snapshot = await db.ref('cache/standings').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

const createLiveMatchHandler = ({
    database = db,
    sameMatch = isSameMatch,
    cupMatch = isTurkeyCupMatch
} = {}) => async function liveMatchHandler(req, res) {
    try {
        const currentMatchSnapshot = await database.ref('cache/nextMatch').once('value');
        const currentMatch = currentMatchSnapshot.val();
        if (!currentMatch) {
            return res.json({ matchState: 'no-match' });
        }

        if (cupMatch(currentMatch)) {
            return res.json({ matchState: 'unsupported' });
        }

        const [liveSnapshot, lastFinishedSnapshot] = await Promise.all([
            database.ref('cache/liveMatch').once('value'),
            database.ref('cache/lastFinishedMatch').once('value')
        ]);
        const liveData = liveSnapshot.val();

        if (liveData && sameMatch(liveData, currentMatch)) {
            return res.json(liveData);
        }

        const lastFinished = lastFinishedSnapshot.val();
        if (lastFinished && sameMatch(lastFinished, currentMatch)) {
            return res.json(lastFinished);
        }

        return res.json({ matchState: 'no-match' });
    } catch (error) {
        console.error('Live match error:', error);
        return res.status(500).json({ error: 'Failed to fetch live match' });
    }
};

const handleLiveMatch = createLiveMatchHandler();

function teamLineupHasDetailedSlots(teamLineup) {
    return Array.isArray(teamLineup?.starters) && teamLineup.starters.some((player) =>
        Number.isFinite(Number(player?.formationPlace))
        || (typeof player?.positionCode === 'string' && player.positionCode.trim().length > 0)
    );
}

function lineupsNeedRefresh(lineups) {
    if (!lineups) return true;
    return !teamLineupHasDetailedSlots(lineups.home) || !teamLineupHasDetailedSlots(lineups.away);
}

async function handleMatchSummary(req, res, matchId) {
    if (!matchId) {
        return res.status(400).json({ error: 'Match ID required' });
    }

    const normalizedMatchId = String(matchId);

    try {
        const snapshot = await db.ref(`cache/matchSummaries/${normalizedMatchId}`).once('value');
        const cachedSummary = snapshot.val();
        if (cachedSummary) {
            const shouldRefreshLineups = lineupsNeedRefresh(cachedSummary.lineups);
            const shouldRefreshSummarySchema = Number(cachedSummary.schemaVersion || 0) < MATCH_SUMMARY_SCHEMA_VERSION;

            // Lazy enrichment: backfill stale lineups and normalized event/stat payloads.
            if (shouldRefreshLineups || shouldRefreshSummarySchema) {
                try {
                    const enriched = await fetchEspnSummaryForMatch(normalizedMatchId);
                    if (enriched) {
                        const updates = {
                            updatedAt: enriched.updatedAt || Date.now()
                        };

                        if (shouldRefreshLineups && enriched.lineups) {
                            updates.lineups = enriched.lineups;
                        }

                        if (shouldRefreshSummarySchema) {
                            updates.schemaVersion = MATCH_SUMMARY_SCHEMA_VERSION;
                            updates.events = Array.isArray(enriched.events) ? enriched.events : [];
                            updates.stats = Array.isArray(enriched.stats) ? enriched.stats : [];
                        }

                        Object.assign(cachedSummary, updates);
                        await db.ref(`cache/matchSummaries/${normalizedMatchId}`).update(updates);
                    }
                } catch (enrichErr) {
                    console.warn(`Match summary enrichment skipped for ${normalizedMatchId}:`, enrichErr.message);
                }
            }
            return res.json(cachedSummary);
        }

        const fetchedSummary = await fetchEspnSummaryForMatch(normalizedMatchId);
        if (!fetchedSummary) {
            return res.status(404).json({ error: 'Match summary not found' });
        }

        await db.ref(`cache/matchSummaries/${normalizedMatchId}`).set(fetchedSummary);
        return res.json(fetchedSummary);
    } catch (error) {
        console.error('Match summary error:', error);
        return res.status(500).json({ error: 'Failed to fetch match summary' });
    }
}

module.exports = {
    handleNextMatch,
    handleNext3Matches,
    handleMatchStatus,
    handleCupFixtures,
    handleUefaJourney,
    createUefaJourneyHandler,
    handleLiveMatch,
    createLiveMatchHandler,
    handleMatchSummary,
    handleStandings
};
