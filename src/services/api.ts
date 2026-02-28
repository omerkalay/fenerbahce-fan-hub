import type {
  Player,
  MatchData,
  StandingsRow,
  StandingsData,
  EspnFixtureMatch,
  EspnFixtureData,
  EspnTeam,
  EspnMatchStatus,
  MatchSummaryData,
} from '../types';

export const BACKEND_URL = 'https://us-central1-fb-hub-ed9de.cloudfunctions.net/api';

const ensureAbsolutePhoto = (player: Partial<Player> = {}): string => {
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

export const fetchNextMatch = async (): Promise<MatchData | null> => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-match`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next match from backend:", error);
        return null;
    }
};

export const fetchSquad = async (): Promise<Player[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/squad`);
        if (!response.ok) throw new Error('Backend fetch failed');
        const squad: Player[] = await response.json();
        return squad.map(player => ({
            ...player,
            photo: ensureAbsolutePhoto(player)
        }));
    } catch (error) {
        console.error("Error fetching squad from backend:", error);
        return [];
    }
};

export const fetchNext3Matches = async (): Promise<MatchData[]> => {
    try {
        const response = await fetch(`${BACKEND_URL}/next-3-matches`);
        if (!response.ok) throw new Error('Backend fetch failed');
        return await response.json();
    } catch (error) {
        console.error("Error fetching next 3 matches from backend:", error);
        return [];
    }
};

export const fetchMatchSummary = async (matchId: string): Promise<MatchSummaryData | null> => {
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

export const fetchInjuries = async (): Promise<never[]> => {
    return [];
};

// ─── ESPN Standings ──────────────────────────────────────

interface EspnStandingsLeague {
  slug: string;
  id: string;
  name: string;
}

const ESPN_STANDINGS_LEAGUES: EspnStandingsLeague[] = [
    { slug: 'tur.1', id: 'super-lig', name: 'Trendyol Süper Lig' },
    { slug: 'uefa.europa', id: 'europa-league', name: 'UEFA Avrupa Ligi' }
];

interface EspnStandingsEntry {
  team: {
    id: string;
    displayName: string;
    logos?: Array<{ href: string }>;
  };
  stats: Array<{ name: string; value: number }>;
}

const parseEspnStandingsEntries = (entries: EspnStandingsEntry[] = []): StandingsRow[] =>
    entries.map(entry => ({
        team: {
            id: entry.team.id,
            name: entry.team.displayName,
            logo: entry.team.logos?.[0]?.href || ''
        },
        rank: entry.stats.find(s => s.name === 'rank')?.value || 0,
        points: entry.stats.find(s => s.name === 'points')?.value || 0,
        matches: entry.stats.find(s => s.name === 'gamesPlayed')?.value || 0,
        wins: entry.stats.find(s => s.name === 'wins')?.value || 0,
        draws: entry.stats.find(s => s.name === 'ties')?.value || 0,
        losses: entry.stats.find(s => s.name === 'losses')?.value || 0,
        goalsFor: entry.stats.find(s => s.name === 'pointsFor')?.value || 0,
        goalsAgainst: entry.stats.find(s => s.name === 'pointsAgainst')?.value || 0,
        goalDiff: entry.stats.find(s => s.name === 'pointDifferential')?.value || 0
    }));

export const fetchEspnStandings = async (leagueId: string): Promise<StandingsData | null> => {
    const league = ESPN_STANDINGS_LEAGUES.find(l => l.id === leagueId);
    if (!league) return null;

    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const season = month >= 6 ? year : year - 1;

    try {
        const url = `https://site.api.espn.com/apis/v2/sports/soccer/${league.slug}/standings?season=${season}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`ESPN standings fetch failed: ${response.status}`);

        const data = await response.json();
        if (!data.children || data.children.length === 0) return null;

        const group = league.slug === 'uefa.europa'
            ? (data.children.find((c: { name: string }) => c.name === 'League Phase') || data.children[0])
            : data.children[0];

        return {
            id: league.id,
            name: league.name,
            rows: parseEspnStandingsEntries(group.standings.entries)
        };
    } catch (error) {
        console.error(`Error fetching ${league.name} standings:`, error);
        return null;
    }
};

// ─── ESPN Fixtures ───────────────────────────────────────

const ESPN_FENERBAHCE_TEAM_ID = '436';
const ESPN_SITE_API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

interface EspnFixtureCompetition {
  slug: string;
  group: string;
  label: string;
}

const ESPN_FIXTURE_COMPETITIONS: EspnFixtureCompetition[] = [
    { slug: 'tur.1', group: 'superlig', label: 'Süper Lig' },
    { slug: 'uefa.europa', group: 'europe', label: 'Avrupa' }
];

const getCurrentSeasonStartYear = (referenceDate = new Date()): number => {
    const month = referenceDate.getMonth();
    const year = referenceDate.getFullYear();
    return month >= 6 ? year : year - 1;
};

const buildEspnTeamScheduleUrl = (leagueSlug: string, params: Record<string, string> = {}): string => {
    const searchParams = new URLSearchParams(params);
    return `${ESPN_SITE_API_ROOT}/${leagueSlug}/teams/${ESPN_FENERBAHCE_TEAM_ID}/schedule?${searchParams.toString()}`;
};

interface EspnCompetitorRaw {
  team?: {
    id?: string;
    displayName?: string;
    name?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logos?: Array<{ href: string }>;
  };
  id?: string;
  homeAway?: string;
  score?: { displayValue?: string; value?: number };
  winner?: boolean;
}

const parseEspnTeam = (competitor: EspnCompetitorRaw | undefined): EspnTeam => ({
    id: competitor?.team?.id ?? competitor?.id ?? null,
    name: competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.displayName ?? competitor?.team?.name ?? 'Takım',
    abbreviation: competitor?.team?.abbreviation ?? null,
    logo: competitor?.team?.logos?.[0]?.href ?? null,
    score: competitor?.score?.displayValue ?? null,
    winner: Boolean(competitor?.winner)
});

interface EspnEventRaw {
  id?: string;
  date?: string;
  season?: { displayName?: string };
  seasonType?: { name?: string };
  competitions?: Array<{
    id?: string;
    date?: string;
    competitors?: EspnCompetitorRaw[];
    status?: { type?: Record<string, unknown> };
    type?: { text?: string };
    venue?: {
      fullName?: string;
      address?: { city?: string };
    };
  }>;
}

const normalizeEspnMatch = (event: EspnEventRaw, sourceCompetition: EspnFixtureCompetition | null = null): EspnFixtureMatch | null => {
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
    const statusType = (competition?.status?.type ?? {}) as Record<string, unknown>;
    const homeScoreValue = Number(homeCompetitor?.score?.value);
    const awayScoreValue = Number(awayCompetitor?.score?.value);
    const hasNumericScore = Number.isFinite(homeScoreValue) && Number.isFinite(awayScoreValue);

    let resultCode: 'G' | 'M' | 'B' | null = null;
    let resultLabel: string | null = null;
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
        date: (event.date ?? competition.date) as string,
        competitionName: (event?.season?.displayName ?? event?.seasonType?.name ?? 'Süper Lig') as string,
        competitionKey: sourceCompetition?.slug ?? null,
        competitionGroup: sourceCompetition?.group ?? null,
        competitionLabel: sourceCompetition?.label ?? null,
        roundLabel: (competition?.type?.text as string) ?? null,
        venueName: (competition?.venue?.fullName as string) ?? null,
        venueCity: (competition?.venue?.address?.city as string) ?? null,
        status: {
            state: (statusType.state as string) ?? 'pre',
            completed: Boolean(statusType.completed),
            description: (statusType.description as string) ?? null,
            detail: (statusType.detail as string) ?? null,
            shortDetail: (statusType.shortDetail as string) ?? null
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

export const fetchEspnFenerbahceFixtures = async (seasonStartYear = getCurrentSeasonStartYear()): Promise<EspnFixtureData> => {
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
                        resultsJson: {} as Record<string, unknown>,
                        fixturesJson: {} as Record<string, unknown>
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

            return [...resultEvents, ...fixtureEvents].map((event: EspnEventRaw) => ({
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
            .filter((m): m is EspnFixtureMatch => m !== null)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const firstAvailable = perCompetitionResults.find(
            ({ resultsJson, fixturesJson }) =>
                (Array.isArray(resultsJson?.events) && resultsJson.events.length > 0) ||
                (Array.isArray(fixturesJson?.events) && fixturesJson.events.length > 0)
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
