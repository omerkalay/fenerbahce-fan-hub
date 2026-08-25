const { db } = require('../config');

const ESPN_TEAM_ID = '436';
const SOFASCORE_TEAM_ID = 3052;
const DEFAULT_DATA_SOURCE_MODES = Object.freeze({
    fixtures: 'espn',
    standings: 'espn',
    statistics: 'espn'
});
const DATA_RESOURCES = Object.freeze(['fixtures', 'standings', 'statistics']);
const ESPN_COMPETITIONS = Object.freeze([
    { slug: 'tur.1', group: 'superlig', label: 'Süper Lig' },
    { slug: 'uefa.champions_qual', group: 'europe', label: 'UEFA Şampiyonlar Ligi Elemeleri' },
    { slug: 'uefa.champions', group: 'europe', label: 'UEFA Şampiyonlar Ligi' },
    { slug: 'uefa.europa_qual', group: 'europe', label: 'UEFA Avrupa Ligi Elemeleri' },
    { slug: 'uefa.europa', group: 'europe', label: 'UEFA Avrupa Ligi' },
    { slug: 'uefa.europa.conf_qual', group: 'europe', label: 'UEFA Konferans Ligi Elemeleri' },
    { slug: 'uefa.europa.conf', group: 'europe', label: 'UEFA Konferans Ligi' }
]);

const asArray = (value) => Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? Object.values(value) : []);

const fetchJson = async (url, fetchImpl = fetch) => {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`upstream/${response.status}`);
    return response.json();
};

const isDateInSeason = (date, seasonStartYear) => {
    const timestamp = new Date(date).getTime();
    if (!Number.isFinite(timestamp)) return false;
    const start = Date.UTC(seasonStartYear, 6, 1);
    const end = Date.UTC(seasonStartYear + 1, 6, 1);
    return timestamp >= start && timestamp < end;
};

const parseEspnTeam = (competitor = {}) => ({
    id: competitor?.team?.id ?? competitor?.id ?? null,
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    abbreviation: competitor?.team?.abbreviation ?? null,
    logo: competitor?.team?.logos?.[0]?.href ?? null,
    score: competitor?.score?.displayValue ?? null,
    winner: competitor?.winner === true
});

const normalizeEspnMatch = (event, sourceCompetition) => {
    const competition = event?.competitions?.[0];
    const competitors = asArray(competition?.competitors);
    const homeCompetitor = competitors.find((item) => item.homeAway === 'home');
    const awayCompetitor = competitors.find((item) => item.homeAway === 'away');
    if (!competition || !homeCompetitor || !awayCompetitor) return null;

    const homeTeam = parseEspnTeam(homeCompetitor);
    const awayTeam = parseEspnTeam(awayCompetitor);
    const isFbHome = String(homeTeam.id) === ESPN_TEAM_ID;
    const fbTeam = isFbHome ? homeTeam : awayTeam;
    const opponentTeam = isFbHome ? awayTeam : homeTeam;
    const statusType = competition?.status?.type || {};
    const homeScore = Number(homeCompetitor?.score?.value);
    const awayScore = Number(awayCompetitor?.score?.value);
    let resultCode = null;
    let resultLabel = null;

    if (statusType.completed && Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
        const fbScore = isFbHome ? homeScore : awayScore;
        const opponentScore = isFbHome ? awayScore : homeScore;
        if (fbScore > opponentScore) [resultCode, resultLabel] = ['G', 'Galibiyet'];
        else if (fbScore < opponentScore) [resultCode, resultLabel] = ['M', 'Mağlubiyet'];
        else [resultCode, resultLabel] = ['B', 'Beraberlik'];
    }

    return {
        id: String(event.id ?? competition.id ?? `${event.date}-${homeTeam.id}-${awayTeam.id}`),
        source: 'espn',
        summaryAvailable: true,
        date: event.date ?? competition.date,
        timeValid: competition.timeValid !== false,
        competitionName: event?.season?.displayName ?? event?.seasonType?.name ?? sourceCompetition.label,
        competitionKey: sourceCompetition.slug,
        competitionGroup: sourceCompetition.group,
        competitionLabel: sourceCompetition.label,
        roundLabel: competition?.type?.text ?? null,
        venueName: competition?.venue?.fullName ?? null,
        venueCity: competition?.venue?.address?.city ?? null,
        status: {
            state: statusType.state ?? 'pre',
            completed: statusType.completed === true,
            description: statusType.description ?? null,
            detail: statusType.detail ?? null,
            shortDetail: statusType.shortDetail ?? null
        },
        homeTeam,
        awayTeam,
        isFbHome,
        fbTeam,
        opponentTeam,
        resultCode,
        resultLabel
    };
};

const scoreValue = (score) => {
    const value = score?.display ?? score?.current;
    return value === undefined || value === null ? null : String(value);
};

const normalizeCupMatch = (match) => {
    const startTimestamp = Number(match?.startTimestamp);
    if (!match?.id || !Number.isFinite(startTimestamp) || !match.homeTeam || !match.awayTeam) return null;
    const isFbHome = Number(match.homeTeam.id) === SOFASCORE_TEAM_ID;
    const isFbAway = Number(match.awayTeam.id) === SOFASCORE_TEAM_ID;
    if (!isFbHome && !isFbAway) return null;
    const completed = Number(match.status?.code) === 100
        || /finished|post/i.test(String(match.status?.type || ''));
    const parseTeam = (team, score, winner) => ({
        id: String(team.id),
        name: team.name || 'Takım',
        shortName: team.shortName || team.name || 'Takım',
        abbreviation: team.nameCode || null,
        logo: null,
        score: scoreValue(score),
        winner
    });
    const homeTeam = parseTeam(match.homeTeam, match.homeScore, Number(match.winnerCode) === 1);
    const awayTeam = parseTeam(match.awayTeam, match.awayScore, Number(match.winnerCode) === 2);
    const fbTeam = isFbHome ? homeTeam : awayTeam;
    const opponentTeam = isFbHome ? awayTeam : homeTeam;
    let resultCode = null;
    let resultLabel = null;
    if (completed) {
        if (Number(match.winnerCode) === 3) [resultCode, resultLabel] = ['B', 'Beraberlik'];
        else {
            const won = (Number(match.winnerCode) === 1 && isFbHome) || (Number(match.winnerCode) === 2 && !isFbHome);
            [resultCode, resultLabel] = won ? ['G', 'Galibiyet'] : ['M', 'Mağlubiyet'];
        }
    }

    return {
        id: String(match.id),
        source: 'sofascore',
        summaryAvailable: false,
        date: new Date(startTimestamp * 1000).toISOString(),
        timeValid: match.timeValid !== false,
        competitionName: 'Türkiye Kupası',
        competitionKey: 'turkiye-kupasi',
        competitionGroup: 'cup',
        competitionLabel: 'Türkiye Kupası',
        roundLabel: match.roundInfo?.name || (match.roundInfo?.round ? `${match.roundInfo.round}. Tur` : null),
        venueName: match.venue?.stadium?.name || match.venue?.name || null,
        venueCity: match.venue?.city?.name || null,
        status: {
            state: completed ? 'post' : (/live|inprogress/i.test(String(match.status?.type || '')) ? 'in' : 'pre'),
            completed,
            description: match.status?.description || null,
            detail: match.status?.description || null,
            shortDetail: match.status?.description || null
        },
        homeTeam,
        awayTeam,
        isFbHome,
        fbTeam,
        opponentTeam,
        resultCode,
        resultLabel
    };
};

const fetchFixtureData = async ({ seasonStartYear, database, fetchImpl }) => {
    const requests = ESPN_COMPETITIONS.flatMap((competition) => [
        { competition, fixture: false },
        { competition, fixture: true }
    ]);
    const settled = await Promise.allSettled(requests.map(async ({ competition, fixture }) => {
        const query = new URLSearchParams({ season: String(seasonStartYear) });
        if (fixture) query.set('fixture', 'true');
        const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${competition.slug}/teams/${ESPN_TEAM_ID}/schedule?${query}`;
        return { competition, data: await fetchJson(url, fetchImpl) };
    }));
    const fulfilled = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const espnMatches = fulfilled
        .flatMap(({ competition, data }) => asArray(data?.events).map((event) => normalizeEspnMatch(event, competition)))
        .filter(Boolean)
        .filter((match) => isDateInSeason(match.date, seasonStartYear));
    if (espnMatches.length === 0) throw new Error('espn/fixtures-unavailable');

    const cupSnapshot = await database.ref(`cache/cupFixtures/${seasonStartYear}/matches`).once('value');
    const cupMatches = asArray(cupSnapshot.val())
        .map(normalizeCupMatch)
        .filter(Boolean)
        .filter((match) => isDateInSeason(match.date, seasonStartYear));
    const matches = Array.from(new Map(
        [...espnMatches, ...cupMatches].map((match) => [`${match.source}:${match.id}`, match])
    ).values()).sort((first, second) => new Date(first.date) - new Date(second.date));
    const firstPayload = fulfilled.find(({ data }) => asArray(data?.events).length > 0)?.data || {};

    return {
        source: 'ESPN + SofaScore',
        seasonStartYear,
        season: firstPayload.season || null,
        team: firstPayload.team || null,
        matches,
        warning: settled.some((result) => result.status === 'rejected')
            ? 'Bazı ESPN kulvarları geçici olarak alınamadı; erişilebilen maçlar gösteriliyor.'
            : null
    };
};

const parseStandingsRows = (entries) => asArray(entries).map((entry) => {
    const stat = (name) => Number(asArray(entry?.stats).find((item) => item.name === name)?.value || 0);
    return {
        team: {
            id: String(entry?.team?.id || ''),
            name: entry?.team?.displayName || 'Takım',
            logo: entry?.team?.logos?.[0]?.href || ''
        },
        rank: stat('rank'),
        points: stat('points'),
        matches: stat('gamesPlayed'),
        wins: stat('wins'),
        draws: stat('ties'),
        losses: stat('losses'),
        goalsFor: stat('pointsFor'),
        goalsAgainst: stat('pointsAgainst'),
        goalDiff: stat('pointDifferential')
    };
});

const fetchStandingsData = async ({ seasonStartYear, fetchImpl }) => {
    const url = `https://site.api.espn.com/apis/v2/sports/soccer/tur.1/standings?season=${seasonStartYear}`;
    const data = await fetchJson(url, fetchImpl);
    const group = asArray(data?.children)[0];
    const rows = parseStandingsRows(group?.standings?.entries);
    if (rows.length === 0) throw new Error('espn/standings-unavailable');
    return { id: 'super-lig', name: 'Trendyol Süper Lig', rows };
};

const athleteStat = (athlete, name) => {
    for (const category of asArray(athlete?.statistics?.splits?.categories)) {
        const found = asArray(category?.stats).find((entry) => entry.name === name);
        if (found?.value != null) return Number(found.value);
    }
    return 0;
};

const fetchRoster = async (slug, seasonStartYear, fetchImpl) => {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${ESPN_TEAM_ID}/roster?season=${seasonStartYear}`;
    const data = await fetchJson(url, fetchImpl);
    return asArray(data?.athletes).map((athlete) => ({
        playerId: String(athlete.id || ''),
        name: athlete.displayName || '',
        goals: athleteStat(athlete, 'totalGoals'),
        assists: athleteStat(athlete, 'goalAssists'),
        appearances: athleteStat(athlete, 'appearances')
    })).filter((player) => player.playerId);
};

const fetchStatisticsData = async ({ seasonStartYear, database, fetchImpl }) => {
    const leagueResult = await Promise.allSettled([fetchRoster('tur.1', seasonStartYear, fetchImpl)]);
    const europeanSlugs = ESPN_COMPETITIONS.filter((competition) => competition.group === 'europe').map((competition) => competition.slug);
    const europeanResults = await Promise.allSettled(europeanSlugs.map((slug) => fetchRoster(slug, seasonStartYear, fetchImpl)));
    const leaguePlayers = leagueResult[0].status === 'fulfilled' ? leagueResult[0].value : [];
    const europeanPlayers = europeanResults
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value);
    if (leaguePlayers.length === 0 && europeanPlayers.length === 0) throw new Error('espn/statistics-unavailable');

    const playerMap = new Map();
    leaguePlayers.forEach((player) => playerMap.set(player.playerId, {
        ...player,
        leagueGoals: player.goals,
        leagueAssists: player.assists,
        europaGoals: 0,
        europaAssists: 0
    }));
    europeanPlayers.forEach((player) => {
        const current = playerMap.get(player.playerId) || {
            playerId: player.playerId,
            name: player.name,
            goals: 0,
            assists: 0,
            appearances: 0,
            leagueGoals: 0,
            leagueAssists: 0,
            europaGoals: 0,
            europaAssists: 0
        };
        current.name ||= player.name;
        current.goals += player.goals;
        current.assists += player.assists;
        current.appearances += player.appearances;
        current.europaGoals += player.goals;
        current.europaAssists += player.assists;
        playerMap.set(player.playerId, current);
    });

    const fixtureSnapshot = await database.ref(`cache/dataSnapshots/${seasonStartYear}/fixtures/data`).once('value');
    const fixtureData = fixtureSnapshot.val() || await fetchFixtureData({ seasonStartYear, database, fetchImpl });
    const resultMap = { G: 'W', M: 'L', B: 'D' };
    const form = asArray(fixtureData.matches)
        .filter((match) => match.status?.completed && match.resultCode)
        .map((match) => ({
            matchId: String(match.id),
            date: match.date,
            opponent: match.opponentTeam?.shortName || match.opponentTeam?.name || 'Rakip',
            result: resultMap[match.resultCode] || 'D',
            score: `${match.homeTeam?.score ?? '0'}-${match.awayTeam?.score ?? '0'}`,
            isHome: match.isFbHome === true
        }))
        .sort((first, second) => new Date(second.date) - new Date(first.date))
        .slice(0, 6);

    return { players: Array.from(playerMap.values()), form };
};

const ensureDataSourceModes = async (database = db) => {
    const modeRef = database.ref('cache/dataSourceModes');
    const transaction = await modeRef.transaction((current) => ({
        ...DEFAULT_DATA_SOURCE_MODES,
        ...(current && typeof current === 'object' ? current : {})
    }));
    return transaction.snapshot.val();
};

const refreshSnapshot = async ({ resource, seasonStartYear, database, fetchImpl, now }) => {
    const snapshotRef = database.ref(`cache/dataSnapshots/${seasonStartYear}/${resource}`);
    const existing = (await snapshotRef.once('value')).val();
    const loaders = {
        fixtures: fetchFixtureData,
        standings: fetchStandingsData,
        statistics: fetchStatisticsData
    };

    try {
        const data = await loaders[resource]({ seasonStartYear, database, fetchImpl });
        const value = { data, fetchedAt: now, lastAttemptAt: now, status: 'ok', errorCode: null };
        await snapshotRef.set(value);
        return { resource, status: 'ok', fetchedAt: now };
    } catch (error) {
        const errorCode = error?.code || error?.message || 'snapshot/unknown';
        await snapshotRef.set({
            ...(existing || {}),
            lastAttemptAt: now,
            status: 'error',
            errorCode
        });
        return { resource, status: 'error', errorCode, preserved: Boolean(existing?.data) };
    }
};

const refreshDataSnapshots = async ({
    resources = DATA_RESOURCES,
    seasonStartYear,
    database = db,
    fetchImpl = fetch,
    now = Date.now()
}) => {
    const requested = resources === 'all' ? DATA_RESOURCES : asArray(resources);
    const validResources = requested.filter((resource) => DATA_RESOURCES.includes(resource));
    if (validResources.length === 0) throw new Error('snapshot/invalid-resources');
    await ensureDataSourceModes(database);
    const ordered = [...new Set(validResources)]
        .sort((first, second) => DATA_RESOURCES.indexOf(first) - DATA_RESOURCES.indexOf(second));
    const results = [];
    for (const resource of ordered) {
        results.push(await refreshSnapshot({ resource, seasonStartYear, database, fetchImpl, now }));
    }
    return results;
};

module.exports = {
    DEFAULT_DATA_SOURCE_MODES,
    DATA_RESOURCES,
    ESPN_COMPETITIONS,
    normalizeEspnMatch,
    normalizeCupMatch,
    parseStandingsRows,
    ensureDataSourceModes,
    refreshDataSnapshots
};
