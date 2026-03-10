import { database } from '../../firebase';
import { ref, get } from 'firebase/database';
import { localizePlayerName } from '../../utils/playerDisplay';
import type { PlayerStat, FormResult, PlayerStatusEntry } from '../../types';
import { fetchEspnFenerbahceFixtures } from './espn-fixtures';

const ESPN_FENERBAHCE_TEAM_ID = '436';
const ESPN_SITE_API_ROOT = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

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
                const validStatuses: PlayerStatusEntry['status'][] = ['injured', 'suspended', 'card-risk', 'doubtful', 'fit'];
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
