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
  PlayerStat,
  FormResult,
  PlayerStatusEntry,
} from '../types';
import { database } from '../firebase';
import { ref, get } from 'firebase/database';
import { localizePlayerName } from '../utils/playerDisplay';
import { localizeCompetitionName, localizeTeamName } from '../utils/localize';

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
            name: localizeTeamName(entry.team.displayName),
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
        competitionName: localizeCompetitionName((event?.season?.displayName ?? event?.seasonType?.name ?? 'Süper Lig') as string),
        competitionKey: sourceCompetition?.slug ?? null,
        competitionGroup: sourceCompetition?.group ?? null,
        competitionLabel: sourceCompetition?.label ? localizeCompetitionName(sourceCompetition.label) : null,
        roundLabel: competition?.type?.text ? localizeCompetitionName(competition.type.text as string) : null,
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

// ─── Statistics (ESPN + Firebase) ────────────────────────

interface EspnRosterStat {
    name?: string;
    value?: number;
}

interface EspnRosterAthlete {
    id?: string;
    displayName?: string;
    statistics?: {
        splits?: {
            categories?: Array<{
                stats?: EspnRosterStat[];
            }>;
        };
    };
}

type RosterStatsMap = Map<string, { name: string; goals: number; assists: number; appearances: number }>;

interface RosterFetchResult {
    players: RosterStatsMap;
    ok: boolean;
}

const getAthleteStat = (athlete: EspnRosterAthlete, statName: string): number => {
    const categories = athlete.statistics?.splits?.categories ?? [];
    for (const cat of categories) {
        const found = cat.stats?.find(s => s.name === statName);
        if (found?.value != null) return found.value;
    }
    return 0;
};

const fetchRosterFromLeague = async (leagueSlug: string): Promise<RosterFetchResult> => {
    const map: RosterStatsMap = new Map<string, { name: string; goals: number; assists: number; appearances: number }>();
    try {
        const url = `${ESPN_SITE_API_ROOT}/${leagueSlug}/teams/${ESPN_FENERBAHCE_TEAM_ID}/roster`;
        const response = await fetch(url);
        if (!response.ok) {
            return { players: map, ok: false };
        }
        const data = await response.json();
        const athletes: EspnRosterAthlete[] = data?.athletes ?? [];
        for (const a of athletes) {
            const id = String(a.id ?? '');
            if (!id) continue;
            map.set(id, {
                name: localizePlayerName(String(a.displayName ?? '')),
                goals: getAthleteStat(a, 'totalGoals'),
                assists: getAthleteStat(a, 'goalAssists'),
                appearances: getAthleteStat(a, 'appearances'),
            });
        }
        return { players: map, ok: true };
    } catch {
        return { players: map, ok: false };
    }
};

export const fetchPlayerStats = async (): Promise<PlayerStat[]> => {
    try {
        const [league, europa] = await Promise.all([
            fetchRosterFromLeague('tur.1'),
            fetchRosterFromLeague('uefa.europa'),
        ]);

        if (!league.ok && !europa.ok) {
            throw new Error('Both ESPN player stats sources failed.');
        }

        const allIds = new Set([...league.players.keys(), ...europa.players.keys()]);
        const players: PlayerStat[] = [];

        for (const id of allIds) {
            const lg = league.players.get(id);
            const eu = europa.players.get(id);
            const name = lg?.name || eu?.name || '';
            const leagueGoals = lg?.goals ?? 0;
            const leagueAssists = lg?.assists ?? 0;
            const europaGoals = eu?.goals ?? 0;
            const europaAssists = eu?.assists ?? 0;

            players.push({
                playerId: id,
                name,
                goals: leagueGoals + europaGoals,
                assists: leagueAssists + europaAssists,
                appearances: (lg?.appearances ?? 0) + (eu?.appearances ?? 0),
                leagueGoals,
                leagueAssists,
                europaGoals,
                europaAssists,
            });
        }

        return players;
    } catch (error) {
        console.error('Error fetching player stats:', error);
        if (error instanceof Error) throw error;
        throw new Error('Player stats fetch failed.');
    }
};

const RESULT_CODE_MAP: Record<string, FormResult['result']> = { G: 'W', M: 'L', B: 'D' };

const POSSESSION_KEYS = ['possessionPct', 'possession'];

export const fetchFormResults = async (): Promise<FormResult[]> => {
    try {
        const fixtureData = await fetchEspnFenerbahceFixtures();
        if (fixtureData.error) {
            throw new Error('ESPN fixture data unavailable.');
        }
        if (!fixtureData.matches || fixtureData.matches.length === 0) return [];

        const completed = fixtureData.matches.filter(m => m.status.completed && m.resultCode);

        const results: FormResult[] = completed.map(m => ({
            matchId: m.id,
            date: m.date,
            opponent: m.opponentTeam.shortName || m.opponentTeam.name,
            result: RESULT_CODE_MAP[m.resultCode!] || 'D',
            score: `${m.homeTeam.score ?? '0'}-${m.awayTeam.score ?? '0'}`,
            isHome: m.isFbHome,
        }));

        results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recent = results.slice(0, 6);

        // Enrich with possession data from match summaries
        try {
            const summaryPromises = recent.map(r =>
                get(ref(database, `cache/matchSummaries/${r.matchId}`))
            );
            const snapshots = await Promise.all(summaryPromises);
            snapshots.forEach((snap, i) => {
                const summary = snap.val();
                if (!summary?.stats) return;
                const stats: Array<{ key?: string; label?: string; homeValue?: string; awayValue?: string }> = summary.stats;
                const possessionStat = stats.find(s => s.key && POSSESSION_KEYS.includes(s.key));
                if (!possessionStat) return;
                const fbValue = recent[i].isHome ? possessionStat.homeValue : possessionStat.awayValue;
                const parsed = parseFloat(String(fbValue).replace('%', ''));
                if (!isNaN(parsed)) recent[i].possession = parsed;
            });
        } catch (e) {
            console.warn('Could not enrich form results with possession data:', e);
        }

        return recent;
    } catch (error) {
        console.error('Error fetching form results:', error);
        if (error instanceof Error) throw error;
        throw new Error('Form results fetch failed.');
    }
};

export const fetchPlayerStatus = async (): Promise<PlayerStatusEntry[]> => {
    try {
        const snapshot = await get(ref(database, 'admin/playerStatus'));
        const raw = snapshot.val();
        if (!raw) return [];

        const entries: unknown[] = Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>);

        return entries
            .filter((entry): entry is Record<string, unknown> =>
                entry !== null && typeof entry === 'object'
            )
            .map(entry => {
                const statusValue = String(entry.status ?? 'fit');
                const validStatuses: PlayerStatusEntry['status'][] = ['injured', 'suspended', 'doubtful', 'fit'];
                const status: PlayerStatusEntry['status'] = validStatuses.includes(statusValue as PlayerStatusEntry['status'])
                    ? (statusValue as PlayerStatusEntry['status'])
                    : 'fit';

                return {
                    name: String(entry.name ?? ''),
                    status,
                    detail: String(entry.detail ?? ''),
                    returnDate: String(entry.returnDate ?? ''),
                    updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : 0,
                };
            });
    } catch (error) {
        console.error('Error fetching player status:', error);
        if (error instanceof Error) throw error;
        throw new Error('Player status fetch failed.');
    }
};
