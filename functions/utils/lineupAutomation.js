const crypto = require('node:crypto');

const FENERBAHCE_NAMES = ['fenerbahce', 'fenerbahçe'];
const LINEUP_POLL_WINDOW_MS = 90 * 60 * 1000;
const LIVE_POLL_WINDOW_MS = 30 * 60 * 1000;
const EARLY_POLL_INTERVAL_MINUTES = 3;

const normalizeText = (value) => String(value || '').trim();
const normalizeNameKey = (value) => normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('tr-TR');

const isFenerbahceName = (value) => {
    const normalized = normalizeNameKey(value);
    return FENERBAHCE_NAMES.some((candidate) => normalized.includes(candidate));
};

const shouldPollLineups = ({ matchTime, now }) => {
    const timeUntilKickoff = Number(matchTime) - Number(now);
    if (!Number.isFinite(timeUntilKickoff)) return false;
    if (timeUntilKickoff > LINEUP_POLL_WINDOW_MS) return false;
    if (timeUntilKickoff <= LIVE_POLL_WINDOW_MS) return true;

    const minutesUntilKickoff = Math.max(0, Math.floor(timeUntilKickoff / 60000));
    return minutesUntilKickoff % EARLY_POLL_INTERVAL_MINUTES === 0;
};

const normalizeLineupPlayer = (value, index) => {
    if (!value || typeof value !== 'object') return null;

    const name = normalizeText(value.name);
    const jersey = normalizeText(value.jersey ?? value.number);
    if (name.length < 2 || name.length > 80 || !/\p{L}/u.test(name) || !/^\d{1,3}$/.test(jersey)) return null;

    const formationPlace = Number(value.formationPlace);
    const order = Number(value.order);
    const positionGroup = ['GK', 'DEF', 'MID', 'FWD'].includes(value.positionGroup)
        ? value.positionGroup
        : undefined;

    return {
        name,
        jersey,
        position: normalizeText(value.position),
        positionCode: normalizeText(value.positionCode),
        ...(Number.isFinite(formationPlace) ? { formationPlace } : {}),
        ...(positionGroup ? { positionGroup } : {}),
        order: Number.isFinite(order) ? order : index
    };
};

const normalizePlayerList = (value, { exactCount = null } = {}) => {
    if (!Array.isArray(value)) return null;

    if (exactCount !== null && value.length !== exactCount) return null;

    const normalizedPlayers = value.map((player, index) => normalizeLineupPlayer(player, index));
    if (exactCount !== null && normalizedPlayers.some((player) => !player)) return null;
    const players = normalizedPlayers.filter(Boolean);

    const uniqueNames = new Set(players.map((player) => normalizeNameKey(player.name)));
    if (uniqueNames.size !== players.length) return null;
    const uniqueJerseys = new Set(players.map((player) => player.jersey));
    if (uniqueJerseys.size !== players.length) return null;
    return players;
};

const normalizeTeamLineup = (value) => {
    if (!value || typeof value !== 'object') return null;

    const starters = normalizePlayerList(value.starters, { exactCount: 11 });
    if (!starters) return null;

    const bench = normalizePlayerList(Array.isArray(value.bench) ? value.bench : []) || [];
    const starterNames = new Set(starters.map((player) => normalizeNameKey(player.name)));
    const filteredBench = bench.filter((player) => !starterNames.has(normalizeNameKey(player.name)));

    return {
        teamId: normalizeText(value.teamId),
        teamName: normalizeText(value.teamName),
        formation: normalizeText(value.formation) || null,
        formationSource: normalizeText(value.formation) ? 'espn' : 'inferred',
        starters,
        bench: filteredBench,
        substitutions: Array.isArray(value.substitutions) ? value.substitutions : []
    };
};

const normalizeCompleteLineups = (lineups) => {
    if (!lineups || typeof lineups !== 'object') return null;
    const home = normalizeTeamLineup(lineups.home);
    const away = normalizeTeamLineup(lineups.away);
    return home && away ? { home, away } : null;
};

const fingerprintLineups = (lineups) => {
    const normalized = normalizeCompleteLineups(lineups);
    if (!normalized) return null;

    const compact = ['home', 'away'].map((side) => ({
        teamId: normalized[side].teamId,
        formation: normalized[side].formation,
        starters: normalized[side].starters.map((player) => ({
            name: normalizeNameKey(player.name),
            jersey: player.jersey,
            formationPlace: player.formationPlace ?? null
        }))
    }));

    return crypto.createHash('sha256').update(JSON.stringify(compact)).digest('hex');
};

const buildPublishedLineup = ({
    matchId,
    espnEventId,
    league,
    lineups,
    homeTeam,
    awayTeam,
    now,
    publishedAt = now,
    sources = { home: 'espn', away: 'espn' }
}) => ({
    matchId: String(matchId),
    espnEventId: String(espnEventId || ''),
    league: normalizeText(league) || null,
    homeTeam: {
        id: String(homeTeam?.id || lineups.home.teamId || ''),
        name: normalizeText(homeTeam?.name || lineups.home.teamName),
        logo: normalizeText(homeTeam?.logo) || null
    },
    awayTeam: {
        id: String(awayTeam?.id || lineups.away.teamId || ''),
        name: normalizeText(awayTeam?.name || lineups.away.teamName),
        logo: normalizeText(awayTeam?.logo) || null
    },
    lineups,
    sources,
    publishedAt,
    updatedAt: now
});

const updateDetectionState = (current, { fingerprint, payload, now }) => {
    const previous = current && typeof current === 'object' ? current : {};
    const sameFingerprint = previous.fingerprint === fingerprint;
    const consecutiveSeen = sameFingerprint ? Number(previous.consecutiveSeen || 0) + 1 : 1;

    return {
        ...previous,
        status: consecutiveSeen >= 2 ? 'ready' : 'observing',
        fingerprint,
        consecutiveSeen,
        firstSeenAt: sameFingerprint && previous.firstSeenAt ? previous.firstSeenAt : now,
        lastSeenAt: now,
        payload
    };
};

module.exports = {
    isFenerbahceName,
    shouldPollLineups,
    normalizeLineupPlayer,
    normalizeTeamLineup,
    normalizeCompleteLineups,
    fingerprintLineups,
    buildPublishedLineup,
    updateDetectionState
};
