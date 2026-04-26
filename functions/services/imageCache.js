const { db, sleep } = require('../config');
const { fetchImage } = require('./sofascore');

const IMAGE_CACHE_ROOT = 'imageCache';
const IMAGE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const IMAGE_REFRESH_DELAY_MS = 250;

const toCacheRecord = (image) => ({
    contentType: image.contentType,
    source: image.source,
    updatedAt: Date.now(),
    body: image.buffer.toString('base64')
});

const toMissingRecord = () => ({
    missing: true,
    updatedAt: Date.now()
});

const fromCacheRecord = (record) => {
    if (!record?.body || !record?.contentType) return null;
    return {
        contentType: record.contentType,
        source: record.source || 'cache',
        updatedAt: record.updatedAt || null,
        buffer: Buffer.from(record.body, 'base64')
    };
};

const readCachedImage = async (type, id) => {
    const snapshot = await db.ref(`${IMAGE_CACHE_ROOT}/${type}/${id}`).once('value');
    return fromCacheRecord(snapshot.val());
};

const isFresh = (record, now = Date.now()) => (
    (record?.missing || (record?.body && record?.contentType))
    && record?.updatedAt
    && now - record.updatedAt < IMAGE_CACHE_TTL_MS
);

const refreshCachedImage = async (type, id, options = {}) => {
    if (!id) return false;

    const ref = db.ref(`${IMAGE_CACHE_ROOT}/${type}/${id}`);
    const snapshot = await ref.once('value');
    const existing = snapshot.val();
    if (!options.force && isFresh(existing)) {
        return false;
    }

    const image = await fetchImage(type, id);
    if (!image) {
        console.warn(`Image cache refresh skipped for ${type}/${id}: source returned no image`);
        await ref.set(toMissingRecord());
        return false;
    }

    await ref.set(toCacheRecord(image));
    return true;
};

const refreshImageSet = async (type, ids, options = {}) => {
    let refreshed = 0;
    let skipped = 0;
    const uniqueIds = [...new Set(ids.filter(Boolean).map(String))];

    for (const id of uniqueIds) {
        try {
            const didRefresh = await refreshCachedImage(type, id, options);
            if (didRefresh) refreshed += 1;
            else skipped += 1;
        } catch (error) {
            skipped += 1;
            console.warn(`Image cache refresh failed for ${type}/${id}:`, error.message);
        }

        if (options.delayMs !== 0) {
            await sleep(options.delayMs || IMAGE_REFRESH_DELAY_MS);
        }
    }

    return { total: uniqueIds.length, refreshed, skipped };
};

const collectTeamIds = (matches = []) => {
    const ids = [];
    for (const match of matches) {
        if (match?.homeTeam?.id) ids.push(match.homeTeam.id);
        if (match?.awayTeam?.id) ids.push(match.awayTeam.id);
    }
    return ids;
};

const collectPlayerIds = (squad = []) => squad
    .map((player) => player?.id)
    .filter(Boolean);

const refreshCachedImagesForCache = async (cache, options = {}) => {
    const matchList = [
        cache.nextMatch,
        ...(cache.next3Matches || []),
        cache.lastFinishedMatch
    ].filter(Boolean);

    const teamIds = collectTeamIds(matchList);
    const playerIds = collectPlayerIds(cache.squad);

    const teams = await refreshImageSet('team', teamIds, options);
    const players = await refreshImageSet('player', playerIds, options);

    await db.ref(`${IMAGE_CACHE_ROOT}/meta`).set({
        updatedAt: Date.now(),
        teams,
        players
    });

    return { teams, players };
};

module.exports = {
    readCachedImage,
    refreshCachedImagesForCache
};
