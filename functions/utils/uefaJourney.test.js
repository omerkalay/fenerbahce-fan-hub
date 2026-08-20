import { describe, expect, it } from 'vitest';
import journeyUtils from './uefaJourney.js';

const {
    UEFA_COMPETITIONS,
    normalizeStageKey,
    normalizeEspnEvent,
    parseStandings,
    buildTies,
    buildBracket,
    resolveParticipation,
    buildFenerPath,
    buildUefaSummary
} = journeyUtils;

const europa = UEFA_COMPETITIONS.find((competition) => competition.key === 'europa');
const champions = UEFA_COMPETITIONS.find((competition) => competition.key === 'champions');

const rawEvent = ({
    id,
    date,
    stage = 'League Phase',
    homeId = '436',
    homeName = 'Fenerbahce',
    awayId = '393',
    awayName = 'Nottingham Forest',
    homeScore = null,
    awayScore = null,
    homeAggregate = null,
    awayAggregate = null,
    completed = false,
    notes = []
}) => ({
    id,
    date,
    season: { year: 2025 },
    seasonType: { name: stage },
    competitions: [{
        id,
        status: { type: { state: completed ? 'post' : 'pre', completed, detail: completed ? 'FT' : null } },
        notes: notes.map((headline) => ({ headline })),
        competitors: [
            {
                id: homeId,
                homeAway: 'home',
                team: { id: homeId, displayName: homeName, shortDisplayName: homeName },
                score: homeScore == null ? null : {
                    value: homeScore,
                    displayValue: String(homeScore),
                    aggregateScore: homeAggregate
                }
            },
            {
                id: awayId,
                homeAway: 'away',
                team: { id: awayId, displayName: awayName, shortDisplayName: awayName },
                score: awayScore == null ? null : {
                    value: awayScore,
                    displayValue: String(awayScore),
                    aggregateScore: awayAggregate
                }
            }
        ]
    }]
});

const normalize = (event, competition = europa, qualifying = false) => normalizeEspnEvent(event, {
    key: competition.key,
    name: qualifying ? competition.qualifierName : competition.name,
    slug: qualifying ? competition.qualifierSlug : competition.mainSlug,
    qualifying
});

const standingsPayload = (competition, rank = 14) => ({
    children: [{
        name: 'League Phase',
        standings: {
            entries: [{
                team: { id: '436', displayName: 'Fenerbahce', logos: [{ href: 'logo.png' }] },
                stats: [
                    { name: 'rank', value: rank },
                    { name: 'points', value: 12 },
                    { name: 'gamesPlayed', value: 8 },
                    { name: 'wins', value: 3 },
                    { name: 'ties', value: 3 },
                    { name: 'losses', value: 2 },
                    { name: 'pointsFor', value: 12 },
                    { name: 'pointsAgainst', value: 10 },
                    { name: 'pointDifferential', value: 2 }
                ]
            }]
        }
    }],
    competition
});

describe('UEFA journey normalization', () => {
    it('normalizes every league and knockout stage used by ESPN', () => {
        expect(normalizeStageKey('League Phase')).toBe('league-phase');
        expect(normalizeStageKey('Knockout Round Playoffs')).toBe('knockout-playoff');
        expect(normalizeStageKey('Round of 16')).toBe('round-of-16');
        expect(normalizeStageKey('Quarterfinals')).toBe('quarterfinals');
        expect(normalizeStageKey('Semifinals')).toBe('semifinals');
        expect(normalizeStageKey('Final')).toBe('final');
        expect(normalizeStageKey('Playoff Round', { qualifying: true })).toBe('qualifying-playoff');
        expect(normalizeStageKey('Third Round', { qualifying: true })).toBe('qualifying-third-round');
    });

    it('reads the team-schedule seasonType field that the old parser missed', () => {
        const event = normalize(rawEvent({
            id: '1',
            date: '2026-02-19T17:45:00Z',
            stage: 'Knockout Round Playoffs'
        }));

        expect(event.stageKey).toBe('knockout-playoff');
        expect(event.stageLabel).toBe('Eleme Play-off’u');
        expect(event.homeTeam.id).toBe('436');
    });

    it('parses a league-phase table and keeps Fenerbahce rank data', () => {
        const standings = parseStandings(standingsPayload(europa), europa);

        expect(standings.name).toBe('UEFA Avrupa Ligi');
        expect(standings.rows[0]).toMatchObject({ rank: 14, points: 12, goalDiff: 2 });
        expect(standings.rows[0].team.id).toBe('436');
    });
});

describe('UEFA knockout ties and bracket', () => {
    it('groups two legs and trusts ESPN aggregate scores', () => {
        const firstLeg = normalize(rawEvent({
            id: 'leg-1',
            date: '2026-02-19T17:45:00Z',
            stage: 'Knockout Round Playoffs',
            homeScore: 0,
            awayScore: 3,
            completed: true
        }));
        const secondLeg = normalize(rawEvent({
            id: 'leg-2',
            date: '2026-02-26T20:00:00Z',
            stage: 'Knockout Round Playoffs',
            homeId: '393',
            homeName: 'Nottingham Forest',
            awayId: '436',
            awayName: 'Fenerbahce',
            homeScore: 1,
            awayScore: 2,
            homeAggregate: 4,
            awayAggregate: 2,
            completed: true,
            notes: ['2nd Leg - Nottingham Forest advance 4-2 on aggregate']
        }));

        const [tie] = buildTies([firstLeg, secondLeg]);
        expect(tie.legs).toHaveLength(2);
        expect(tie.aggregate).toEqual({ '393': 4, '436': 2 });
        expect(tie.winnerTeamId).toBe('393');
    });

    it('links a completed tie to the next published round without predicting missing ties', () => {
        const playoff = normalize(rawEvent({
            id: 'playoff',
            date: '2026-02-26T20:00:00Z',
            stage: 'Knockout Round Playoffs',
            homeId: '393',
            homeName: 'Nottingham Forest',
            awayId: '436',
            awayName: 'Fenerbahce',
            homeScore: 2,
            awayScore: 0,
            completed: true
        }));
        const roundOf16 = normalize(rawEvent({
            id: 'r16',
            date: '2026-03-12T20:00:00Z',
            stage: 'Round of 16',
            homeId: '393',
            homeName: 'Nottingham Forest',
            awayId: '999',
            awayName: 'Roma'
        }));

        const bracket = buildBracket([playoff, roundOf16], europa);
        expect(bracket.stages).toHaveLength(2);
        expect(bracket.stages[0].ties[0].nextTieId).toBe(bracket.stages[1].ties[0].id);
    });

    it('does not connect a winner to an unrelated published tie', () => {
        const playoff = normalize(rawEvent({
            id: 'playoff-unrelated',
            date: '2026-02-26T20:00:00Z',
            stage: 'Knockout Round Playoffs',
            homeScore: 2,
            awayScore: 0,
            completed: true
        }));
        const roundOf16 = normalize(rawEvent({
            id: 'r16-unrelated',
            date: '2026-03-12T20:00:00Z',
            stage: 'Round of 16',
            homeId: '777',
            homeName: 'Roma',
            awayId: '999',
            awayName: 'Lyon'
        }));

        const bracket = buildBracket([playoff, roundOf16], europa);
        expect(bracket.stages[0].ties[0].nextTieId).toBeNull();
    });
});

describe('UEFA participation and Fener path', () => {
    it('keeps the dashboard generic during Champions League qualifying', () => {
        const qualifier = normalize(rawEvent({
            id: 'qualifier',
            date: '2026-08-26T19:00:00Z',
            stage: 'Playoff Round'
        }), champions, true);

        const participation = resolveParticipation({ events: [qualifier], now: Date.UTC(2026, 7, 20) });
        const summary = buildUefaSummary({
            source: 'ESPN',
            seasonStartYear: 2026,
            participation
        });

        expect(participation.state).toBe('qualifying');
        expect(summary.title).toBe('Avrupa Yolculuğu');
        expect(summary.qualifierName).toBe('UEFA Şampiyonlar Ligi Elemeleri');
        expect(summary.phaseLabel).toBe('Eleme Play-off Turu');
    });

    it('prefers the confirmed Europa League destination over old Champions League qualifiers', () => {
        const oldQualifier = normalize(rawEvent({
            id: 'ucl-q',
            date: '2025-08-20T19:00:00Z',
            stage: 'Playoff Round',
            completed: true,
            homeScore: 0,
            awayScore: 1
        }), champions, true);
        const europaLeague = normalize(rawEvent({
            id: 'uel-1',
            date: '2025-09-24T19:00:00Z',
            stage: 'League Phase'
        }), europa, false);
        const standings = parseStandings(standingsPayload(europa), europa);

        const participation = resolveParticipation({
            events: [oldQualifier, europaLeague],
            standingsByKey: { europa: standings },
            now: Date.UTC(2025, 8, 1)
        });
        const path = buildFenerPath({
            events: [oldQualifier, europaLeague],
            standings,
            participation
        });

        expect(participation.state).toBe('league_phase');
        expect(participation.competition.key).toBe('europa');
        expect(path.find((stage) => stage.key === 'qualifying-playoff').status).toBe('transferred');
    });

    it('keeps same-numbered qualifier rounds separate after a competition transfer', () => {
        const championsQualifier = normalize(rawEvent({
            id: 'ucl-third',
            date: '2025-08-05T19:00:00Z',
            stage: 'Third Round',
            completed: true,
            homeScore: 0,
            awayScore: 1
        }), champions, true);
        const europaQualifier = normalize(rawEvent({
            id: 'uel-third',
            date: '2025-08-12T19:00:00Z',
            stage: 'Third Round'
        }), europa, true);
        const participation = resolveParticipation({
            events: [championsQualifier, europaQualifier],
            now: Date.UTC(2025, 7, 10)
        });
        const path = buildFenerPath({
            events: [championsQualifier, europaQualifier],
            participation
        });

        expect(path.slice(0, 2).map((stage) => stage.competitionKey)).toEqual(['champions', 'europa']);
        expect(path.slice(0, 2).map((stage) => stage.status)).toEqual(['transferred', 'active']);
    });

    it('shows the knockout play-off as bypassed after a top-eight league finish', () => {
        const league = normalize(rawEvent({
            id: 'league-top-eight',
            date: '2026-01-29T20:00:00Z',
            stage: 'League Phase',
            homeScore: 2,
            awayScore: 0,
            completed: true
        }), champions, false);
        const standings = parseStandings(standingsPayload(champions, 6), champions);
        const participation = resolveParticipation({
            events: [league],
            standingsByKey: { champions: standings }
        });
        const path = buildFenerPath({ events: [league], standings, participation });

        expect(path.find((stage) => stage.key === 'knockout-playoff').status).toBe('bypassed');
        expect(path.find((stage) => stage.key === 'round-of-16').status).toBe('upcoming');
    });

    it('marks a lost knockout tie as eliminated and locks later path stages', () => {
        const league = normalize(rawEvent({
            id: 'league',
            date: '2026-01-29T20:00:00Z',
            stage: 'League Phase',
            homeScore: 1,
            awayScore: 1,
            completed: true
        }));
        const playoff = normalize(rawEvent({
            id: 'playoff',
            date: '2026-02-26T20:00:00Z',
            stage: 'Knockout Round Playoffs',
            homeId: '393',
            homeName: 'Nottingham Forest',
            awayId: '436',
            awayName: 'Fenerbahce',
            homeScore: 2,
            awayScore: 0,
            completed: true
        }));
        const standings = parseStandings(standingsPayload(europa, 14), europa);
        const participation = resolveParticipation({
            events: [league, playoff],
            standingsByKey: { europa: standings }
        });
        const path = buildFenerPath({ events: [league, playoff], standings, participation });

        expect(participation.state).toBe('eliminated');
        expect(path.find((stage) => stage.key === 'knockout-playoff').status).toBe('eliminated');
        expect(path.find((stage) => stage.key === 'round-of-16').status).toBe('locked');
    });
});
