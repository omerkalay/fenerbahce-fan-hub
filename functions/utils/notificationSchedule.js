const MATCH_NOTIFICATION_CONFIG = {
    threeHours: { offsetMs: 3 * 60 * 60 * 1000, timeText: '3 saat kaldı' },
    oneHour: { offsetMs: 60 * 60 * 1000, timeText: '1 saat kaldı' },
    thirtyMinutes: { offsetMs: 30 * 60 * 1000, timeText: '30 dakika kaldı' },
    fifteenMinutes: { offsetMs: 15 * 60 * 1000, timeText: '15 dakika kaldı' }
};

const NOTIFICATION_WINDOW_MS = 5 * 60 * 1000;

const formatDateKey = (timestamp, timeZone) => (
    new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(timestamp))
);

const getHourAndMinute = (timestamp, timeZone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(new Date(timestamp));

    return {
        hour: Number(parts.find((part) => part.type === 'hour')?.value),
        minute: Number(parts.find((part) => part.type === 'minute')?.value)
    };
};

const buildNotificationSchedule = (nextMatches, now, timeZone = 'Europe/Istanbul') => {
    const matches = Array.isArray(nextMatches) ? nextMatches : [];
    const { hour, minute } = getHourAndMinute(now, timeZone);
    const isDailyWindow = hour === 9 && minute >= 0 && minute <= 4;
    const todayKey = formatDateKey(now, timeZone);
    const firstMatch = matches[0] || null;
    const firstMatchTime = Number(firstMatch?.startTimestamp) * 1000;
    const dailyMatch = isDailyWindow
        && Number.isFinite(firstMatchTime)
        && formatDateKey(firstMatchTime, timeZone) === todayKey
        ? firstMatch
        : null;

    const matchWindows = [];
    for (const match of matches) {
        const matchTime = Number(match?.startTimestamp) * 1000;
        if (!Number.isFinite(matchTime) || matchTime <= 0) continue;

        for (const [optionKey, config] of Object.entries(MATCH_NOTIFICATION_CONFIG)) {
            const triggerTime = matchTime - config.offsetMs;
            if (now >= triggerTime && now < triggerTime + NOTIFICATION_WINDOW_MS) {
                matchWindows.push({
                    match,
                    matchId: String(match.id),
                    matchTime,
                    optionKey,
                    timeText: config.timeText,
                    triggerTime,
                    delayMs: now - triggerTime
                });
            }
        }
    }

    return {
        todayKey,
        dailyMatch,
        matchWindows,
        shouldReadNotifications: Boolean(dailyMatch) || matchWindows.length > 0
    };
};

module.exports = {
    MATCH_NOTIFICATION_CONFIG,
    NOTIFICATION_WINDOW_MS,
    buildNotificationSchedule
};
