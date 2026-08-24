const { admin, db } = require('../config');
const {
    isFenerbahceName,
    normalizeCompleteLineups,
    fingerprintLineups,
    buildPublishedLineup,
    updateDetectionState
} = require('../utils/lineupAutomation');

const DEFAULT_LINEUP_SETTINGS = Object.freeze({
    autoPublishLineups: false,
    autoPushLineups: false
});
const LINEUP_WRITE_LOCK_TTL_MS = 30 * 1000;

const getLineupSettings = async (database = db) => {
    const snapshot = await database.ref('ops/adminSettings/lineups').once('value');
    const value = snapshot.val() || {};
    return {
        autoPublishLineups: value.autoPublishLineups === true,
        autoPushLineups: value.autoPushLineups === true
    };
};

const acquireNotificationLock = async (notificationRef, now) => {
    const result = await notificationRef.transaction((current) => {
        if (current) {
            return;
        }
        return { status: 'sending', attemptedAt: now };
    });
    return result.committed;
};

const acquireLineupWriteLock = async (database, matchId, operationId, now = Date.now()) => {
    const lockRef = database.ref(`ops/lineups/${matchId}/writeLock`);
    const result = await lockRef.transaction((current) => {
        if (current?.expiresAt > now) return;
        return { operationId, acquiredAt: now, expiresAt: now + LINEUP_WRITE_LOCK_TTL_MS };
    });
    return result.committed;
};

const releaseLineupWriteLock = async (database, matchId, operationId) => {
    const lockRef = database.ref(`ops/lineups/${matchId}/writeLock`);
    await lockRef.transaction((current) => (
        current?.operationId === operationId ? null : current
    ));
};

const mergePublishedWithLiveLineups = (publishedLineups, liveLineups) => {
    if (!publishedLineups) return liveLineups || null;
    if (!liveLineups) return publishedLineups;

    return Object.fromEntries(['home', 'away'].map((side) => {
        const published = publishedLineups[side];
        const live = liveLineups[side];
        if (!published) return [side, live || null];
        if (!live) return [side, published];
        return [side, {
            ...published,
            bench: Array.isArray(published.bench) && published.bench.length > 0
                ? published.bench
                : (live.bench || []),
            substitutions: live.substitutions || published.substitutions || []
        }];
    }));
};

const mergeDetectedOpponentWithManual = (existing, detected, now = Date.now()) => {
    if (!existing?.lineups || !detected?.lineups) return null;

    const homeIsFenerbahce = isFenerbahceName(detected.homeTeam?.name);
    const awayIsFenerbahce = isFenerbahceName(detected.awayTeam?.name);
    if (homeIsFenerbahce === awayIsFenerbahce) return null;

    const fenerSide = homeIsFenerbahce ? 'home' : 'away';
    const opponentSide = fenerSide === 'home' ? 'away' : 'home';
    const manualLineup = existing.lineups[fenerSide];
    if (!manualLineup) return null;

    return {
        ...detected,
        lineups: {
            ...detected.lineups,
            [fenerSide]: manualLineup,
            [opponentSide]: detected.lineups[opponentSide]
        },
        sources: {
            ...(detected.sources || {}),
            [fenerSide]: 'manual',
            [opponentSide]: detected.sources?.[opponentSide] || 'espn'
        },
        publishedAt: existing.publishedAt || now,
        updatedAt: now
    };
};

const hasPublicLineupChanged = (existing, next) => {
    if (!existing) return true;
    const selectComparableData = (value) => ({
        espnEventId: value?.espnEventId || '',
        league: value?.league || null,
        homeTeam: value?.homeTeam || null,
        awayTeam: value?.awayTeam || null,
        lineups: value?.lineups || null,
        sources: value?.sources || null
    });
    return JSON.stringify(selectComparableData(existing)) !== JSON.stringify(selectComparableData(next));
};

const sendStartingLineupPush = async ({ database = db, messaging = admin.messaging(), matchId, now }) => {
    const notificationRef = database.ref(`ops/lineups/${matchId}/notification`);
    const acquired = await acquireNotificationLock(notificationRef, now);
    if (!acquired) return { sent: false, reason: 'deduplicated' };

    try {
        const messageId = await messaging.send({
            topic: 'all_fans',
            data: {
                title: 'İlk 11’ler Açıklandı!',
                body: 'Fenerbahçe maçının kadroları ve dizilişleri hazır',
                url: 'https://omerkalay.com/fenerbahce-fan-hub/',
                type: 'startingXI',
                matchId: String(matchId)
            }
        });
        await notificationRef.set({ status: 'accepted', attemptedAt: now, acceptedAt: Date.now(), messageId });
        return { sent: true, messageId };
    } catch (error) {
        const errorCode = error?.code || 'messaging/unknown';
        await notificationRef.set({
            status: 'failed',
            attemptedAt: now,
            failedAt: Date.now(),
            errorCode
        });
        return { sent: false, reason: 'failed', errorCode };
    }
};

const observeEspnLineups = async ({
    database = db,
    messaging = admin.messaging(),
    scheduledMatch,
    espnEventId,
    league,
    matchState,
    lineups,
    homeTeam,
    awayTeam,
    now = Date.now()
}) => {
    const matchId = String(scheduledMatch?.id || '');
    const matchTime = Number(scheduledMatch?.startTimestamp) * 1000;
    const normalizedLineups = normalizeCompleteLineups(lineups);
    const fingerprint = fingerprintLineups(normalizedLineups);

    if (!matchId || !normalizedLineups || !fingerprint) {
        return { status: 'incomplete' };
    }

    const detectedPayload = buildPublishedLineup({
        matchId,
        espnEventId,
        league,
        lineups: normalizedLineups,
        homeTeam,
        awayTeam,
        now
    });
    const detectionRef = database.ref(`ops/lineups/${matchId}/detection`);
    const transaction = await detectionRef.transaction((current) => (
        updateDetectionState(current, { fingerprint, payload: detectedPayload, now })
    ));
    const detection = transaction.snapshot.val();

    await database.ref('ops/health/lineupAutomation').update({
        lastRunAt: now,
        lastMatchId: matchId,
        lastEspnEventId: String(espnEventId || ''),
        status: detection.status,
        consecutiveSeen: detection.consecutiveSeen
    });

    if (detection.status !== 'ready') {
        return { status: detection.status, consecutiveSeen: detection.consecutiveSeen };
    }

    const settings = await getLineupSettings(database);
    if (!settings.autoPublishLineups) {
        return { status: 'ready', published: false, reason: 'auto-publish-disabled' };
    }

    const operationId = `auto:${fingerprint}:${now}`;
    const acquired = await acquireLineupWriteLock(database, matchId, operationId, now);
    if (!acquired) return { status: 'ready', published: false, reason: 'write-locked' };

    let publicPayload;
    try {
        const [lockSnapshot, existingSnapshot] = await Promise.all([
            database.ref(`ops/lineups/${matchId}/manualLocked`).once('value'),
            database.ref(`cache/matchLineups/${matchId}`).once('value')
        ]);
        const existing = existingSnapshot.val();
        if (lockSnapshot.val() === true) {
            const merged = mergeDetectedOpponentWithManual(existing, detectedPayload, now);
            if (!merged) return { status: 'ready', published: false, reason: 'manual-lock' };
            const updated = hasPublicLineupChanged(existing, merged);
            if (updated) await database.ref(`cache/matchLineups/${matchId}`).set(merged);
            return {
                status: 'ready',
                published: true,
                reason: 'manual-fener-preserved',
                updated,
                notification: { sent: false, reason: 'manual-lock' }
            };
        }
        publicPayload = {
            ...detectedPayload,
            publishedAt: existing?.publishedAt || now,
            updatedAt: now
        };
        if (hasPublicLineupChanged(existing, publicPayload)) {
            await database.ref(`cache/matchLineups/${matchId}`).set(publicPayload);
        }
    } finally {
        await releaseLineupWriteLock(database, matchId, operationId);
    }

    let notification = { sent: false, reason: 'disabled' };
    if (settings.autoPushLineups && matchState === 'pre' && now < matchTime) {
        notification = await sendStartingLineupPush({ database, messaging, matchId, now });
    }

    return { status: 'ready', published: true, notification };
};

module.exports = {
    DEFAULT_LINEUP_SETTINGS,
    getLineupSettings,
    acquireNotificationLock,
    acquireLineupWriteLock,
    releaseLineupWriteLock,
    mergePublishedWithLiveLineups,
    mergeDetectedOpponentWithManual,
    hasPublicLineupChanged,
    sendStartingLineupPush,
    observeEspnLineups
};
