// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UefaBracket, UefaJourneyMatch, UefaPathStage } from '../types';
import {
    buildBracketLayout,
    getBracketCanvasHeight,
    UEFA_BRACKET_DENSITIES,
    UEFA_BRACKET_STAGE_SPECS,
} from '../utils/uefaBracketLayout';
import {
    UefaBracketView,
    UefaPathView,
} from './UefaJourneyContent';

const match: UefaJourneyMatch = {
    id: 'match-1',
    date: '2026-08-12T19:00:00Z',
    seasonYear: 2026,
    competitionKey: 'champions',
    competitionName: 'UEFA Şampiyonlar Ligi Elemeleri',
    competitionSlug: 'uefa.champions_qual',
    qualifying: true,
    stageKey: 'qualifying-third-round',
    stageLabel: '3. Eleme Turu',
    status: { state: 'post', completed: true, detail: 'MS' },
    homeTeam: {
        id: '436', name: 'Fenerbahce', shortName: 'Fenerbahce', abbreviation: 'FEN', logo: null, score: '2'
    },
    awayTeam: {
        id: '999', name: 'Besiktas', shortName: 'Besiktas', abbreviation: 'BJK', logo: null, score: '1'
    },
    notes: []
};

describe('UefaPathView', () => {
    it('renders the route as plain timeline text and localizes match teams', () => {
        const stages: UefaPathStage[] = [{
            key: 'qualifying-third-round',
            label: '3. Eleme Turu',
            competitionKey: 'champions',
            competitionName: 'UEFA Şampiyonlar Ligi Elemeleri',
            status: 'transferred',
            matches: [match],
            aggregate: { '436': 2, '999': 1 },
            winnerTeamId: '436',
            position: null,
            points: null
        }];

        render(<UefaPathView stages={stages} />);

        expect(screen.getByText('3. Eleme Turu')).toBeInTheDocument();
        expect(screen.getByText('Alt kulvara geçti')).toBeInTheDocument();
        expect(screen.getByText('Fenerbahçe')).toBeInTheDocument();
        expect(screen.getByText('Beşiktaş')).toBeInTheDocument();
        expect(screen.getByText('Toplam skor 2–1')).toBeInTheDocument();
        expect(screen.getByAltText('Fenerbahce logosu')).toHaveAttribute(
            'src',
            'https://a.espncdn.com/i/teamlogos/soccer/500/436.png'
        );
    });

    it('always presents aggregate scores from Fenerbahce perspective', () => {
        const stages: UefaPathStage[] = [{
            key: 'qualifying-third-round',
            label: '3. Eleme Turu',
            competitionKey: 'champions',
            competitionName: 'UEFA Şampiyonlar Ligi Elemeleri',
            status: 'completed',
            matches: [],
            aggregate: { '999': 4, '436': 6 },
            winnerTeamId: '436',
            position: null,
            points: null
        }];

        render(<UefaPathView stages={stages} />);

        expect(screen.getByText('Toplam skor 6–4')).toBeInTheDocument();
    });
});

describe('UefaBracketView', () => {
    it('renders every knockout round in one connected bracket canvas', () => {
        const bracket: UefaBracket = {
            competition: {
                key: 'champions',
                name: 'UEFA Şampiyonlar Ligi',
                shortName: 'Şampiyonlar Ligi',
                mainSlug: 'uefa.champions',
                qualifierSlug: 'uefa.champions_qual',
                qualifierName: 'UEFA Şampiyonlar Ligi Elemeleri'
            },
            stages: [
                {
                    key: 'knockout-playoff',
                    label: 'Eleme Play-off’u',
                    ties: [{
                        id: 'tie-1',
                        stageKey: 'knockout-playoff',
                        stageLabel: 'Eleme Play-off’u',
                        teams: [match.homeTeam, match.awayTeam],
                        legs: [match],
                        aggregate: { '436': 2, '999': 1 },
                        winnerTeamId: '436',
                        status: 'completed',
                        nextTieId: 'tie-2'
                    }]
                },
                {
                    key: 'round-of-16',
                    label: 'Son 16',
                    ties: [{
                        id: 'tie-2',
                        stageKey: 'round-of-16',
                        stageLabel: 'Son 16',
                        teams: [
                            { ...match.homeTeam, name: 'Fenerbahce' },
                            { ...match.awayTeam, id: '888', name: 'Roma', shortName: 'Roma' }
                        ],
                        legs: [],
                        aggregate: null,
                        winnerTeamId: null,
                        status: 'upcoming',
                        nextTieId: null
                    }]
                }
            ]
        };

        const layout = buildBracketLayout(bracket);
        expect(layout.map((stage) => stage.ties.length)).toEqual([8, 8, 4, 2, 1]);
        expect(layout[0].ties[0]?.id).toBe('tie-1');
        expect(layout[1].ties[0]?.id).toBe('tie-2');

        render(<UefaBracketView bracket={bracket} />);

        expect(screen.getByLabelText('UEFA turnuva ağacı')).toBeInTheDocument();
        UEFA_BRACKET_STAGE_SPECS.forEach((stage) => {
            expect(screen.getByText(stage.label)).toBeInTheDocument();
        });
        expect(screen.getByText('Roma')).toBeInTheDocument();
        expect(screen.getAllByText('Kura bekleniyor')).toHaveLength(21);
        expect(screen.getByTestId('bracket-connector')).toHaveAttribute('stroke', '#facc15');
    });

    it('shows the complete 8/8/4/2/1 draw skeleton before ties are published', () => {
        render(<UefaBracketView bracket={null} />);

        expect(screen.getAllByText('Kura bekleniyor')).toHaveLength(23);
        expect(screen.queryByTestId('bracket-connector')).not.toBeInTheDocument();
        expect(getBracketCanvasHeight(UEFA_BRACKET_DENSITIES.mobile)).toBe(590);
        expect(getBracketCanvasHeight(UEFA_BRACKET_DENSITIES.mobile)).toBeLessThan(
            getBracketCanvasHeight(UEFA_BRACKET_DENSITIES.desktop)
        );
    });
});
