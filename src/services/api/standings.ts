import type { StandingsRow, StandingsData } from '../../types';
import { localizeTeamName } from '../../utils/localize';

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
