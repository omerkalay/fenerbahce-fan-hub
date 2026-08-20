const {
    FENERBAHCE_ESPN_ID,
    UEFA_COMPETITIONS,
    normalizeEspnEvent,
    parseStandings,
    eventContainsTeam,
    buildBracket,
    resolveParticipation,
    buildFenerPath,
    buildUefaSummary
} = require('../utils/uefaJourney');

const ESPN_SITE_API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_STANDINGS_API_ROOT = 'https://site.api.espn.com/apis/v2/sports/soccer';
const FETCH_TIMEOUT_MS = 10_000;

const fetchJson = async (url) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            return { ok: false, data: null, status: response.status };
        }
        return { ok: true, data: await response.json(), status: response.status };
    } catch (error) {
        console.warn(`UEFA ESPN request failed: ${url}`, error.message);
        return { ok: false, data: null, status: null };
    } finally {
        clearTimeout(timeoutId);
    }
};

const buildScheduleDescriptor = (competition, qualifying) => ({
    key: competition.key,
    name: qualifying ? competition.qualifierName : competition.name,
    slug: qualifying ? competition.qualifierSlug : competition.mainSlug,
    qualifying
});

const fetchTeamSchedule = async (descriptor, seasonStartYear) => {
    const baseUrl = `${ESPN_SITE_API_ROOT}/${descriptor.slug}/teams/${FENERBAHCE_ESPN_ID}/schedule`;
    const [results, fixtures] = await Promise.all([
        fetchJson(`${baseUrl}?season=${seasonStartYear}`),
        fetchJson(`${baseUrl}?season=${seasonStartYear}&fixture=true`)
    ]);
    const rawEvents = [
        ...(Array.isArray(results?.data?.events) ? results.data.events : []),
        ...(Array.isArray(fixtures?.data?.events) ? fixtures.data.events : [])
    ];

    return {
        descriptor,
        ok: results.ok || fixtures.ok,
        events: rawEvents
            .map((event) => normalizeEspnEvent(event, descriptor))
            .filter(Boolean)
            .filter((event) => event.seasonYear == null || event.seasonYear === seasonStartYear)
            .filter((event) => eventContainsTeam(event))
    };
};

const fetchCompetitionStandings = async (competition, seasonStartYear) => {
    const result = await fetchJson(
        `${ESPN_STANDINGS_API_ROOT}/${competition.mainSlug}/standings?season=${seasonStartYear}`
    );

    return {
        competition,
        ok: result.ok,
        standings: result.ok ? parseStandings(result.data, competition) : null
    };
};

const fetchCompetitionScoreboard = async (competition, seasonStartYear) => {
    const descriptor = buildScheduleDescriptor(competition, false);
    const results = await Promise.all([
        fetchJson(`${ESPN_SITE_API_ROOT}/${competition.mainSlug}/scoreboard?dates=${seasonStartYear}&limit=1000`),
        fetchJson(`${ESPN_SITE_API_ROOT}/${competition.mainSlug}/scoreboard?dates=${seasonStartYear + 1}&limit=1000`)
    ]);

    return {
        ok: results.some((result) => result.ok),
        events: results
            .flatMap((result) => Array.isArray(result?.data?.events) ? result.data.events : [])
            .map((event) => normalizeEspnEvent(event, descriptor))
            .filter(Boolean)
            .filter((event) => event.seasonYear == null || event.seasonYear === seasonStartYear)
    };
};

const mergeTeam = (current, next) => ({
    ...current,
    ...next,
    score: next?.score ?? current?.score ?? null,
    aggregateScore: next?.aggregateScore ?? current?.aggregateScore ?? null,
    shootoutScore: next?.shootoutScore ?? current?.shootoutScore ?? null,
    logo: next?.logo || current?.logo || null
});

const mergeEvents = (...eventGroups) => {
    const map = new Map();

    for (const event of eventGroups.flat()) {
        if (!event?.id) continue;
        const current = map.get(event.id);
        if (!current) {
            map.set(event.id, event);
            continue;
        }

        map.set(event.id, {
            ...current,
            ...event,
            date: event.date || current.date,
            stageKey: event.stageKey !== 'unknown' ? event.stageKey : current.stageKey,
            stageLabel: event.stageKey !== 'unknown' ? event.stageLabel : current.stageLabel,
            status: event.status?.completed || event.status?.state === 'in' ? event.status : current.status,
            homeTeam: mergeTeam(current.homeTeam, event.homeTeam),
            awayTeam: mergeTeam(current.awayTeam, event.awayTeam),
            notes: Array.from(new Set([...(current.notes || []), ...(event.notes || [])]))
        });
    }

    return Array.from(map.values()).sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
};

const publicCompetition = (competition) => competition ? ({
    key: competition.key,
    name: competition.name,
    shortName: competition.shortName,
    mainSlug: competition.mainSlug,
    qualifierSlug: competition.qualifierSlug,
    qualifierName: competition.qualifierName
}) : null;

const buildUefaJourneyPayload = async (seasonStartYear, { now = Date.now() } = {}) => {
    const scheduleDescriptors = UEFA_COMPETITIONS.flatMap((competition) => [
        buildScheduleDescriptor(competition, true),
        buildScheduleDescriptor(competition, false)
    ]);

    const [scheduleResults, standingsResults] = await Promise.all([
        Promise.all(scheduleDescriptors.map((descriptor) => fetchTeamSchedule(descriptor, seasonStartYear))),
        Promise.all(UEFA_COMPETITIONS.map((competition) => fetchCompetitionStandings(competition, seasonStartYear)))
    ]);

    const teamEvents = mergeEvents(scheduleResults.flatMap((result) => result.events));
    const standingsByKey = Object.fromEntries(
        standingsResults
            .filter((result) => result.standings)
            .map((result) => [result.competition.key, result.standings])
    );
    const fetchSucceeded = scheduleResults.some((result) => result.ok)
        || standingsResults.some((result) => result.ok);
    let participation = resolveParticipation({
        events: teamEvents,
        standingsByKey,
        fetchSucceeded,
        now
    });

    let scoreboardEvents = [];
    if (participation.competition) {
        const scoreboard = await fetchCompetitionScoreboard(participation.competition, seasonStartYear);
        scoreboardEvents = scoreboard.events;
    }

    const allEvents = mergeEvents(teamEvents, scoreboardEvents);
    participation = resolveParticipation({
        events: allEvents,
        standingsByKey,
        fetchSucceeded,
        now
    });

    const competition = participation.competition;
    const standings = competition ? standingsByKey[competition.key] || null : null;
    const payloadParticipation = {
        state: participation.state,
        competition: publicCompetition(competition),
        qualifier: publicCompetition(participation.qualifier),
        phaseLabel: participation.phaseLabel
    };
    const bracket = competition
        ? buildBracket(
            allEvents.filter((event) => event.competitionKey === competition.key && !event.qualifying),
            publicCompetition(competition)
        )
        : null;

    return {
        source: 'ESPN',
        seasonStartYear,
        lastUpdate: now,
        stale: false,
        participation: payloadParticipation,
        standings,
        fenerPath: buildFenerPath({
            events: allEvents,
            standings,
            participation: payloadParticipation
        }),
        bracket
    };
};

const refreshUefaJourneyCache = async (seasonStartYear, options = {}) => {
    const payload = await buildUefaJourneyPayload(seasonStartYear, options);
    const database = options.database || require('../config').db;
    await database.ref(`cache/uefaJourney/${seasonStartYear}`).set(payload);
    return payload;
};

const readUefaJourneyCache = async (seasonStartYear, { database = null } = {}) => {
    const targetDatabase = database || require('../config').db;
    const snapshot = await targetDatabase.ref(`cache/uefaJourney/${seasonStartYear}`).once('value');
    return snapshot.val() || null;
};

module.exports = {
    FETCH_TIMEOUT_MS,
    fetchJson,
    fetchTeamSchedule,
    fetchCompetitionStandings,
    fetchCompetitionScoreboard,
    mergeEvents,
    buildUefaJourneyPayload,
    refreshUefaJourneyCache,
    readUefaJourneyCache,
    buildUefaSummary
};
