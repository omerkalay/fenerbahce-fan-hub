import type {
    LineupPlayer,
    LiveMatchData,
    LiveMatchState,
    MatchData,
    MatchEvent,
    MatchLineups,
    MatchStat,
    PublishedMatchLineups,
    TeamLineup,
} from '../types';

export const DEV_LIVE_SCENARIOS = [
    'countdown',
    'pre-match',
    'first-half',
    'halftime',
    'second-half',
    'stoppage',
    'finished',
    'partial-data',
] as const;

export type DevLiveScenario = typeof DEV_LIVE_SCENARIOS[number];

export interface DevLiveSimulation {
    scenario: DevLiveScenario;
    matchData: MatchData;
    liveMatchState: LiveMatchState;
    liveMatchData: LiveMatchData;
    startingXI: PublishedMatchLineups | null;
}

const MATCH_ID = 9900213;
const FENERBAHCE_ID = '3052';
const LYON_ESPN_ID = '167';
const FENERBAHCE_LOGO = `${import.meta.env.BASE_URL}icons/fenerbahce.png`;
const LYON_LOGO = `https://a.espncdn.com/i/teamlogos/soccer/500/${LYON_ESPN_ID}.png`;

const createPlayer = (
    name: string,
    jersey: string,
    position: string,
    positionCode: string,
    positionGroup: LineupPlayer['positionGroup'],
    order: number,
): LineupPlayer => ({ name, jersey, position, positionCode, positionGroup, order });

const fenerbahceStarters: LineupPlayer[] = [
    createPlayer('Ederson', '31', 'Kaleci', 'GK', 'GK', 1),
    createPlayer('Nélson Semedo', '2', 'Sağ Bek', 'RB', 'DEF', 2),
    createPlayer('Milan Škriniar', '37', 'Stoper', 'RCB', 'DEF', 3),
    createPlayer('Jayden Oosterwolde', '24', 'Stoper', 'LCB', 'DEF', 4),
    createPlayer('Archie Brown', '3', 'Sol Bek', 'LB', 'DEF', 5),
    createPlayer('İsmail Yüksek', '5', 'Orta Saha', 'DM', 'MID', 6),
    createPlayer('Fred', '13', 'Orta Saha', 'CM', 'MID', 7),
    createPlayer('Marco Asensio', '21', 'Sağ Kanat', 'RW', 'FWD', 8),
    createPlayer('Anderson Talisca', '94', 'On Numara', 'AM', 'MID', 9),
    createPlayer('Kerem Aktürkoğlu', '9', 'Sol Kanat', 'LW', 'FWD', 10),
    createPlayer('Jhon Durán', '10', 'Santrfor', 'ST', 'FWD', 11),
];

const fenerbahceBench: LineupPlayer[] = [
    createPlayer('İrfan Can Eğribayat', '1', 'Kaleci', 'GK', 'GK', 12),
    createPlayer('Çağlar Söyüncü', '4', 'Stoper', 'CB', 'DEF', 13),
    createPlayer('Sofyan Amrabat', '34', 'Orta Saha', 'DM', 'MID', 14),
    createPlayer('İrfan Can Kahveci', '17', 'Kanat', 'RW', 'FWD', 15),
    createPlayer('Youssef En-Nesyri', '19', 'Santrfor', 'ST', 'FWD', 16),
];

const lyonStarters: LineupPlayer[] = [
    createPlayer('Rémy Descamps', '40', 'Kaleci', 'GK', 'GK', 1),
    createPlayer('Ainsley Maitland-Niles', '98', 'Sağ Bek', 'RB', 'DEF', 2),
    createPlayer('Clinton Mata', '22', 'Stoper', 'RCB', 'DEF', 3),
    createPlayer('Moussa Niakhaté', '19', 'Stoper', 'LCB', 'DEF', 4),
    createPlayer('Nicolás Tagliafico', '3', 'Sol Bek', 'LB', 'DEF', 5),
    createPlayer('Tanner Tessmann', '15', 'Orta Saha', 'DM', 'MID', 6),
    createPlayer('Corentin Tolisso', '8', 'Orta Saha', 'CM', 'MID', 7),
    createPlayer('Adam Karabec', '7', 'Sağ Kanat', 'RW', 'FWD', 8),
    createPlayer('Pavel Šulc', '10', 'On Numara', 'AM', 'MID', 9),
    createPlayer('Malick Fofana', '11', 'Sol Kanat', 'LW', 'FWD', 10),
    createPlayer('Enzo Molebe', '29', 'Santrfor', 'ST', 'FWD', 11),
];

const lyonBench: LineupPlayer[] = [
    createPlayer('Mathieu Patouillet', '16', 'Kaleci', 'GK', 'GK', 12),
    createPlayer('Abner Vinícius', '20', 'Sol Bek', 'LB', 'DEF', 13),
    createPlayer('Orel Mangala', '25', 'Orta Saha', 'CM', 'MID', 14),
    createPlayer('Ernest Nuamah', '37', 'Kanat', 'RW', 'FWD', 15),
    createPlayer('Alejandro Gomes Rodríguez', '39', 'Santrfor', 'ST', 'FWD', 16),
];

const homeLineup: TeamLineup = {
    teamId: FENERBAHCE_ID,
    teamName: 'Fenerbahçe',
    formation: '4-2-3-1',
    formationSource: 'espn',
    starters: fenerbahceStarters,
    bench: fenerbahceBench,
    substitutions: [],
};

const awayLineup: TeamLineup = {
    teamId: LYON_ESPN_ID,
    teamName: 'Olympique Lyonnais',
    formation: '4-2-3-1',
    formationSource: 'espn',
    starters: lyonStarters,
    bench: lyonBench,
    substitutions: [],
};

const homeSubstitutions: TeamLineup['substitutions'] = [
    { minute: '63', playerIn: 'Youssef En-Nesyri', playerOut: 'Jhon Durán' },
    { minute: '81', playerIn: 'İrfan Can Kahveci', playerOut: 'Marco Asensio' },
];

const awaySubstitutions: TeamLineup['substitutions'] = [
    { minute: '66', playerIn: 'Ernest Nuamah', playerOut: 'Adam Karabec' },
    { minute: '84', playerIn: 'Alejandro Gomes Rodríguez', playerOut: 'Enzo Molebe' },
];

const buildLineups = ({
    homeSubstitutionCount = 0,
    awaySubstitutionCount = 0,
    includeAway = true,
}: {
    homeSubstitutionCount?: number;
    awaySubstitutionCount?: number;
    includeAway?: boolean;
} = {}): MatchLineups => ({
    home: { ...homeLineup, substitutions: homeSubstitutions.slice(0, homeSubstitutionCount) },
    away: includeAway
        ? { ...awayLineup, substitutions: awaySubstitutions.slice(0, awaySubstitutionCount) }
        : null,
});

const initialLineups = buildLineups();
const partialInitialLineups = buildLineups({ includeAway: false });

const allEvents: MatchEvent[] = [
    { clock: '12', player: 'Tanner Tessmann', team: LYON_ESPN_ID, type: 'Yellow Card', isYellowCard: true },
    { clock: '18', player: 'Anderson Talisca', team: FENERBAHCE_ID, type: 'Goal', isGoal: true, assist: 'Marco Asensio' },
    { clock: '21', player: 'Talisca golü', team: FENERBAHCE_ID, type: 'VAR - Goal confirmed' },
    { clock: '41', player: 'Malick Fofana', team: LYON_ESPN_ID, type: 'Goal', isGoal: true, assist: 'Corentin Tolisso' },
    { clock: '57', player: 'Kerem Aktürkoğlu', team: FENERBAHCE_ID, type: 'Goal', isGoal: true, assist: 'Fred' },
    { clock: '63', player: 'Youssef En-Nesyri', playerOut: 'Jhon Durán', team: FENERBAHCE_ID, type: 'Substitution', isSubstitution: true },
    { clock: '66', player: 'Ernest Nuamah', playerOut: 'Adam Karabec', team: LYON_ESPN_ID, type: 'Substitution', isSubstitution: true },
    { clock: '72', player: 'Fred', team: FENERBAHCE_ID, type: 'Yellow Card', isYellowCard: true },
    { clock: '74', player: 'Pavel Šulc', team: LYON_ESPN_ID, type: 'Goal', isGoal: true, assist: 'Ernest Nuamah' },
    { clock: '78', player: 'Moussa Niakhaté', team: LYON_ESPN_ID, type: 'Red Card', isRedCard: true },
    { clock: '81', player: 'İrfan Can Kahveci', playerOut: 'Marco Asensio', team: FENERBAHCE_ID, type: 'Substitution', isSubstitution: true },
    { clock: '84', player: 'Alejandro Gomes Rodríguez', playerOut: 'Enzo Molebe', team: LYON_ESPN_ID, type: 'Substitution', isSubstitution: true },
    { clock: '90+1', player: 'Lyon golü', team: LYON_ESPN_ID, type: 'VAR - Goal disallowed' },
    { clock: '90+3', player: 'Youssef En-Nesyri', team: FENERBAHCE_ID, type: 'Goal', isGoal: true, assist: 'Kerem Aktürkoğlu' },
];

const stats: MatchStat[] = [
    { name: 'possessionPct', homeValue: '56%', awayValue: '44%' },
    { name: 'totalShots', homeValue: '14', awayValue: '10' },
    { name: 'shotsOnTarget', homeValue: '7', awayValue: '4' },
    { name: 'wonCorners', homeValue: '6', awayValue: '4' },
    { name: 'foulsCommitted', homeValue: '11', awayValue: '14' },
    { name: 'yellowCards', homeValue: '1', awayValue: '1' },
    { name: 'redCards', homeValue: '0', awayValue: '1' },
];

const matchData: MatchData = {
    id: MATCH_ID,
    startTimestamp: Math.floor(Date.now() / 1000) - 68 * 60,
    homeTeam: { id: Number(FENERBAHCE_ID), name: 'Fenerbahçe', shortName: 'Fenerbahçe' },
    awayTeam: { id: 1649, name: 'Olympique Lyonnais', shortName: 'Lyon' },
    tournament: {
        name: 'UEFA Champions League',
        uniqueTournament: { name: 'UEFA Champions League', slug: 'uefa-champions-league', id: 7 },
    },
    roundInfo: { name: 'Playoffs', slug: 'playoffs' },
    venue: { name: 'Chobani Stadyumu Fenerbahçe Şükrü Saracoğlu Spor Kompleksi', city: { name: 'İstanbul' } },
    status: { description: 'In progress', type: 'inprogress' },
};

const buildStartingXI = (lineups: MatchLineups): PublishedMatchLineups => ({
    matchId: String(MATCH_ID),
    espnEventId: 'mock-espn-9900213',
    league: 'uefa.champions',
    homeTeam: { id: FENERBAHCE_ID, name: 'Fenerbahçe', logo: FENERBAHCE_LOGO },
    awayTeam: { id: LYON_ESPN_ID, name: 'Olympique Lyonnais', logo: LYON_LOGO },
    lineups,
    sources: { home: 'espn', away: lineups.away ? 'espn' : null },
    publishedAt: Date.now() - 60 * 60 * 1000,
    updatedAt: Date.now(),
});

const createLiveData = ({
    matchState = 'in',
    displayClock,
    statusDetail,
    score,
    eventCount,
    selectedStats = stats,
    lineups = initialLineups,
}: {
    matchState?: LiveMatchData['matchState'];
    displayClock: string;
    statusDetail: string;
    score: [string, string];
    eventCount: number;
    selectedStats?: MatchStat[];
    lineups?: MatchLineups;
}): LiveMatchData => ({
    matchId: String(MATCH_ID),
    startTimestamp: matchData.startTimestamp,
    matchState,
    displayClock,
    statusDetail,
    homeTeam: { id: FENERBAHCE_ID, name: 'Fenerbahçe', logo: FENERBAHCE_LOGO, score: score[0] },
    awayTeam: { id: LYON_ESPN_ID, name: 'Olympique Lyonnais', logo: LYON_LOGO, score: score[1] },
    events: allEvents.slice(0, eventCount),
    stats: selectedStats,
    lineups,
});

export const resolveDevLiveScenario = (
    search: string,
    isDev: boolean = import.meta.env.DEV,
): DevLiveScenario | null => {
    if (!isDev) return null;
    const value = new URLSearchParams(search).get('mockLive');
    return DEV_LIVE_SCENARIOS.includes(value as DevLiveScenario) ? value as DevLiveScenario : null;
};

export const buildDevLiveSimulation = (scenario: DevLiveScenario): DevLiveSimulation => {
    if (scenario === 'countdown' || scenario === 'pre-match') {
        const secondsUntilKickoff = scenario === 'countdown' ? (25 * 60 * 60) + (20 * 60) : 3 * 60;
        const upcomingMatchData: MatchData = {
            ...matchData,
            startTimestamp: Math.floor(Date.now() / 1000) + secondsUntilKickoff,
            status: { description: 'Not started', type: 'notstarted' },
        };
        const upcomingLiveData = createLiveData({
            displayClock: '',
            statusDetail: 'Not started',
            score: ['0', '0'],
            eventCount: 0,
            lineups: initialLineups,
        });

        return {
            scenario,
            matchData: upcomingMatchData,
            liveMatchState: scenario === 'countdown' ? 'countdown' : 'pre',
            liveMatchData: { ...upcomingLiveData, startTimestamp: upcomingMatchData.startTimestamp },
            startingXI: null,
        };
    }

    const common = { scenario, matchData, liveMatchState: scenario === 'finished' ? 'post' as const : 'in' as const };

    if (scenario === 'first-half') {
        return {
            ...common,
            liveMatchData: createLiveData({ displayClock: "32'", statusDetail: '1st Half', score: ['1', '0'], eventCount: 3, lineups: buildLineups() }),
            startingXI: buildStartingXI(initialLineups),
        };
    }
    if (scenario === 'halftime') {
        return {
            ...common,
            liveMatchData: createLiveData({ displayClock: 'HT', statusDetail: 'Halftime', score: ['1', '1'], eventCount: 4, lineups: buildLineups() }),
            startingXI: buildStartingXI(initialLineups),
        };
    }
    if (scenario === 'second-half') {
        return {
            ...common,
            liveMatchData: createLiveData({ displayClock: "68'", statusDetail: '2nd Half', score: ['2', '1'], eventCount: 7, lineups: buildLineups({ homeSubstitutionCount: 1, awaySubstitutionCount: 1 }) }),
            startingXI: buildStartingXI(initialLineups),
        };
    }
    if (scenario === 'stoppage') {
        return {
            ...common,
            liveMatchData: createLiveData({ displayClock: "90+4'", statusDetail: '2nd Half', score: ['2', '2'], eventCount: 13, lineups: buildLineups({ homeSubstitutionCount: 2, awaySubstitutionCount: 2 }) }),
            startingXI: buildStartingXI(initialLineups),
        };
    }
    if (scenario === 'finished') {
        return {
            ...common,
            liveMatchData: createLiveData({ matchState: 'post', displayClock: 'FT', statusDetail: 'Full Time', score: ['3', '2'], eventCount: allEvents.length, lineups: buildLineups({ homeSubstitutionCount: 2, awaySubstitutionCount: 2 }) }),
            startingXI: buildStartingXI(initialLineups),
        };
    }

    const partialStats: MatchStat[] = [{ name: 'possessionPct', homeValue: '53%', awayValue: '47%' }];
    const partialEvents: MatchEvent[] = [
        { clock: '22', player: 'Anderson Talisca', team: FENERBAHCE_ID, type: 'Goal', isGoal: true },
        { clock: '49', player: '', team: LYON_ESPN_ID, type: 'Yellow Card', isYellowCard: true },
    ];
    const partialLiveData = createLiveData({
        displayClock: "54'",
        statusDetail: '2nd Half',
        score: ['1', '0'],
        eventCount: 0,
        selectedStats: partialStats,
        lineups: partialInitialLineups,
    });
    partialLiveData.events = partialEvents;

    return {
        ...common,
        liveMatchData: partialLiveData,
        startingXI: buildStartingXI(partialInitialLineups),
    };
};
