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
