const { db } = require('../config');
const { fetchEspnSummaryForMatch } = require('../services/espn');

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

async function handleStandings(req, res) {
    const snapshot = await db.ref('cache/standings').once('value');
    const data = snapshot.val() || [];
    return res.json(data);
}

async function handleLiveMatch(req, res) {
    try {
        const liveSnapshot = await db.ref('cache/liveMatch').once('value');
        const liveData = liveSnapshot.val();
        if (liveData) {
            return res.json(liveData);
        }

        const lastFinishedSnapshot = await db.ref('cache/lastFinishedMatch').once('value');
        const lastFinished = lastFinishedSnapshot.val();
        if (lastFinished) {
            return res.json(lastFinished);
        }

        return res.json({ matchState: 'no-match' });
    } catch (error) {
        console.error('Live match error:', error);
        return res.status(500).json({ error: 'Failed to fetch live match' });
    }
}

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
            // Lazy enrichment: backfill or refresh stale lineup payloads in cached summaries
            if (lineupsNeedRefresh(cachedSummary.lineups)) {
                try {
                    const enriched = await fetchEspnSummaryForMatch(normalizedMatchId);
                    if (enriched?.lineups) {
                        cachedSummary.lineups = enriched.lineups;
                        cachedSummary.updatedAt = Date.now();
                        await db.ref(`cache/matchSummaries/${normalizedMatchId}`).update({
                            lineups: enriched.lineups,
                            updatedAt: cachedSummary.updatedAt
                        });
                    }
                } catch (enrichErr) {
                    console.warn(`Lineup enrichment skipped for ${normalizedMatchId}:`, enrichErr.message);
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

module.exports = { handleNextMatch, handleNext3Matches, handleLiveMatch, handleMatchSummary, handleStandings };
