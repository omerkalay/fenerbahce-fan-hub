/**
 * API Service - Firebase Cloud Functions Backend
 * 
 * Artık Render.com yerine Firebase kullanıyor!
 */

// Backend API URL - Firebase Cloud Functions
// Local development da production backend'e bağlanıyor
export const BACKEND_URL = 'https://us-central1-fb-hub-ed9de.cloudfunctions.net/api';

const ensureAbsolutePhoto = (player = {}) => {
    const fallbackPath = `/player-image/${player.id ?? ''}`;
    const value = player.photo || fallbackPath;

    if (value.startsWith('http://') && !value.includes('localhost')) {
        return value.replace(/^http:\/\//i, 'https://');
    }

    if (value.startsWith('http://') || value.startsWith('https://')) {
        return value;
    }

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    return `${BACKEND_URL}${normalizedPath}`;
};

// Fetch next match from backend
export const fetchNextMatch = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-match`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next match from backend:", error);
        return null;
    }
};

// Fetch squad from backend
export const fetchSquad = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/squad`);
        if (!response.ok) throw new Error('Backend fetch failed');
        const squad = await response.json();
        return squad.map(player => ({
            ...player,
            photo: ensureAbsolutePhoto(player)
        }));
    } catch (error) {
        console.error("Error fetching squad from backend:", error);
        return [];
    }
};

// Fetch next 3 matches from backend
export const fetchNext3Matches = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-3-matches`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next 3 matches from backend:", error);
        return [];
    }
};

// Fetch stored match summary for fixture cards
export const fetchMatchSummary = async (matchId) => {
    if (!matchId) return null;

    try {
        const response = await fetch(`${BACKEND_URL}/match-summary/${matchId}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Match summary fetch failed');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching match summary from backend:', error);
        return null;
    }
};

// Injuries - not implemented yet
export const fetchInjuries = async () => {
    return [];
};

// Fetch standings from backend
export const fetchStandings = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/standings`);
        if (!response.ok) throw new Error('Standings fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching standings from backend:", error);
        return [];
    }
};

const ESPN_FENERBAHCE_TEAM_ID = '436';
const ESPN_SITE_API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_FIXTURE_COMPETITIONS = [
    { slug: 'tur.1', group: 'superlig', label: 'Süper Lig' },
    { slug: 'uefa.europa', group: 'europe', label: 'Avrupa' }
];

const getCurrentSeasonStartYear = (referenceDate = new Date()) => {
    const month = referenceDate.getMonth(); // 0-indexed
    const year = referenceDate.getFullYear();
    return month >= 6 ? year : year - 1;
};

const buildEspnTeamScheduleUrl = (leagueSlug, params = {}) => {
    const searchParams = new URLSearchParams(params);
    return `${ESPN_SITE_API_ROOT}/${leagueSlug}/teams/${ESPN_FENERBAHCE_TEAM_ID}/schedule?${searchParams.toString()}`;
};

const parseEspnTeam = (competitor) => ({
    id: competitor?.team?.id ?? competitor?.id ?? null,
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    abbreviation: competitor?.team?.abbreviation ?? null,
    logo: competitor?.team?.logos?.[0]?.href ?? null,
    score: competitor?.score?.displayValue ?? null,
    winner: Boolean(competitor?.winner)
});

const normalizeEspnMatch = (event, sourceCompetition = null) => {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const homeCompetitor = competitors.find((item) => item.homeAway === 'home');
    const awayCompetitor = competitors.find((item) => item.homeAway === 'away');

    if (!competition || !homeCompetitor || !awayCompetitor) {
        return null;
    }

    const homeTeam = parseEspnTeam(homeCompetitor);
    const awayTeam = parseEspnTeam(awayCompetitor);
    const isFbHome = homeTeam.id === ESPN_FENERBAHCE_TEAM_ID;
    const fbTeam = isFbHome ? homeTeam : awayTeam;
    const opponentTeam = isFbHome ? awayTeam : homeTeam;
    const statusType = competition?.status?.type ?? {};
    const homeScoreValue = Number(homeCompetitor?.score?.value);
    const awayScoreValue = Number(awayCompetitor?.score?.value);
    const hasNumericScore = Number.isFinite(homeScoreValue) && Number.isFinite(awayScoreValue);

    let resultCode = null;
    let resultLabel = null;
    if (statusType.completed && hasNumericScore) {
        const fbScore = isFbHome ? homeScoreValue : awayScoreValue;
        const opponentScore = isFbHome ? awayScoreValue : homeScoreValue;

        if (fbScore > opponentScore) {
            resultCode = 'G';
            resultLabel = 'Galibiyet';
        } else if (fbScore < opponentScore) {
            resultCode = 'M';
            resultLabel = 'Mağlubiyet';
        } else {
            resultCode = 'B';
            resultLabel = 'Beraberlik';
        }
    }

    return {
        id: String(event.id ?? competition.id ?? `${event.date}-${homeTeam.id}-${awayTeam.id}`),
        date: event.date ?? competition.date,
        competitionName: event?.season?.displayName ?? event?.seasonType?.name ?? 'Süper Lig',
        competitionKey: sourceCompetition?.slug ?? null,
        competitionGroup: sourceCompetition?.group ?? null,
        competitionLabel: sourceCompetition?.label ?? null,
        roundLabel: competition?.type?.text ?? null,
        venueName: competition?.venue?.fullName ?? null,
        venueCity: competition?.venue?.address?.city ?? null,
        status: {
            state: statusType.state ?? 'pre',
            completed: Boolean(statusType.completed),
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

export const fetchEspnFenerbahceFixtures = async (seasonStartYear = getCurrentSeasonStartYear()) => {
    try {
        const perCompetitionResults = await Promise.all(
            ESPN_FIXTURE_COMPETITIONS.map(async (competition) => {
                const [resultsResponse, fixturesResponse] = await Promise.all([
                    fetch(buildEspnTeamScheduleUrl(competition.slug, { season: String(seasonStartYear) })),
                    fetch(buildEspnTeamScheduleUrl(competition.slug, { season: String(seasonStartYear), fixture: 'true' }))
                ]);

                if (!resultsResponse.ok && !fixturesResponse.ok) {
                    return {
                        competition,
                        resultsJson: {},
                        fixturesJson: {}
                    };
                }

                const [resultsJson, fixturesJson] = await Promise.all([
                    resultsResponse.ok ? resultsResponse.json() : Promise.resolve({}),
                    fixturesResponse.ok ? fixturesResponse.json() : Promise.resolve({})
                ]);

                return {
                    competition,
                    resultsJson,
                    fixturesJson
                };
            })
        );

        const mergedEvents = perCompetitionResults.flatMap(({ competition, resultsJson, fixturesJson }) => {
            const resultEvents = Array.isArray(resultsJson?.events) ? resultsJson.events : [];
            const fixtureEvents = Array.isArray(fixturesJson?.events) ? fixturesJson.events : [];

            return [...resultEvents, ...fixtureEvents].map((event) => ({
                event,
                sourceCompetition: competition
            }));
        });

        if (mergedEvents.length === 0) {
            throw new Error('ESPN fixture fetch failed');
        }

        const uniqueEvents = Array.from(
            new Map(
                mergedEvents.map(({ event, sourceCompetition }) => [
                    String(event?.id ?? `${sourceCompetition?.slug}-${event?.date}`),
                    { event, sourceCompetition }
                ])
            ).values()
        );

        const matches = uniqueEvents
            .map(({ event, sourceCompetition }) => normalizeEspnMatch(event, sourceCompetition))
            .filter(Boolean)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const firstAvailable = perCompetitionResults.find(
            ({ resultsJson, fixturesJson }) =>
                Array.isArray(resultsJson?.events) && resultsJson.events.length > 0 ||
                Array.isArray(fixturesJson?.events) && fixturesJson.events.length > 0
        );

        return {
            source: 'ESPN',
            seasonStartYear,
            season: firstAvailable?.fixturesJson?.season ?? firstAvailable?.resultsJson?.season ?? null,
            team: firstAvailable?.fixturesJson?.team ?? firstAvailable?.resultsJson?.team ?? null,
            matches
        };
    } catch (error) {
        console.error('Error fetching ESPN Fenerbahce fixtures:', error);
        return {
            source: 'ESPN',
            seasonStartYear,
            season: null,
            team: null,
            matches: [],
            error: true
        };
    }
};
