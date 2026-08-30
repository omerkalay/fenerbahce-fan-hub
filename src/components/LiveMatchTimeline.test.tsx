// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LiveMatchTimeline from './LiveMatchTimeline';

describe('LiveMatchTimeline', () => {
    it('separates home and away events while exposing assist and VAR decisions', () => {
        render(
            <LiveMatchTimeline
                homeTeamId="home"
                awayTeamId="away"
                homeTeamName="Fenerbahçe"
                awayTeamName="Olympique Lyonnais"
                events={[
                    { clock: '18', player: 'Golcü', team: 'home', type: 'Goal', isGoal: true, assist: 'Asistçi' },
                    { clock: '41', player: 'Rakip Oyuncu', team: 'away', type: 'Yellow Card', isYellowCard: true },
                    { clock: '90+1', player: 'Rakip golü', team: 'away', type: 'VAR - Goal disallowed' },
                ]}
            />
        );

        expect(screen.getByText('Asist: Asistçi')).toBeInTheDocument();
        expect(screen.getByText('Gol kararı iptal edildi')).toBeInTheDocument();
        expect(screen.getByLabelText(/Fenerbahçe, Golcü/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Olympique Lyonnais, Rakip Oyuncu/)).toBeInTheDocument();
    });

    it('renders a clear empty state when event data is unavailable', () => {
        render(<LiveMatchTimeline events={[]} />);
        expect(screen.getByText(/Maç olayı henüz paylaşılmadı/)).toBeInTheDocument();
    });

    it('uses the team name for unattributed cards and never exposes raw card labels', () => {
        render(
            <LiveMatchTimeline
                compact
                homeTeamId="11429"
                awayTeamId="436"
                homeTeamName="Samsunspor"
                awayTeamName="Fenerbahçe"
                events={[
                    { clock: '25', player: '', team: '11429', type: 'Yellow Card', isYellowCard: true },
                    { clock: '70', player: 'Romelu Lukaku', team: '436', type: 'Yellow Card', isYellowCard: true },
                ]}
            />
        );

        expect(screen.getByText('Samsunspor')).toBeInTheDocument();
        expect(screen.getByText('Romelu Lukaku')).toBeInTheDocument();
        expect(screen.queryByText('Yellow Card')).not.toBeInTheDocument();
        expect(screen.queryByText('Sarı kart')).not.toBeInTheDocument();
        expect(screen.getByLabelText(/Samsunspor, Sarı kart/)).toBeInTheDocument();
        expect(screen.getByLabelText(/Fenerbahçe, Romelu Lukaku, Sarı kart/)).toBeInTheDocument();
    });

    it('shows only the outgoing player name with a rose tone for substitutions', () => {
        render(
            <LiveMatchTimeline
                homeTeamId="home"
                awayTeamId="away"
                events={[
                    {
                        clock: '63',
                        player: 'Youssef En-Nesyri',
                        playerOut: 'Marco Asensio',
                        team: 'home',
                        type: 'Substitution',
                        isSubstitution: true,
                    },
                ]}
            />
        );

        expect(screen.getByText('Marco Asensio')).toHaveClass('text-rose-300/85');
        expect(screen.queryByText('Marco Asensio çıktı')).not.toBeInTheDocument();
    });
});
