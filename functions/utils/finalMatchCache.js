const FINAL_LIVE_CACHE_TTL_MS = 5 * 60 * 1000;

const isSameMatchId = (first, second) => (
    first?.matchId != null
    && second?.matchId != null
    && String(first.matchId) === String(second.matchId)
);

const buildFinalMatchCachePlan = ({ liveData, existingFinal = null, now }) => {
    const sameExistingMatch = isSameMatchId(liveData, existingFinal);
    const existingFinalizedAt = sameExistingMatch ? Number(existingFinal.finalizedAt) : NaN;
    const finalizedAt = Number.isFinite(existingFinalizedAt) && existingFinalizedAt > 0
        ? existingFinalizedAt
        : now;
    const expired = now - finalizedAt >= FINAL_LIVE_CACHE_TTL_MS;

    return {
        expired,
        finalizedAt,
        livePayload: {
            ...liveData,
            postMarkedAt: finalizedAt
        },
        finalPayload: {
            ...liveData,
            archivedAt: sameExistingMatch && existingFinal.archivedAt
                ? existingFinal.archivedAt
                : now,
            finalizedAt,
            liveCacheClearedAt: expired ? now : null
        }
    };
};

const shouldStopFinalPolling = ({ finalData, scheduledMatch, now, matches }) => {
    if (!finalData || finalData.matchState !== 'post') return false;
    if (!matches(finalData, scheduledMatch)) return false;

    const finalizedAt = Number(finalData.finalizedAt);
    return Number.isFinite(finalizedAt)
        && finalizedAt > 0
        && now - finalizedAt >= FINAL_LIVE_CACHE_TTL_MS;
};

module.exports = {
    FINAL_LIVE_CACHE_TTL_MS,
    buildFinalMatchCachePlan,
    shouldStopFinalPolling
};
