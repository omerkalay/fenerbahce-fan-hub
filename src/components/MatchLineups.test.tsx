// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchLineups as MatchLineupsData, TeamLineup } from '../types';
import MatchLineups from './MatchLineups';

vi.mock('../services/api', () => ({
    fetchSquad: vi.fn().mockResolvedValue([])
}));

const makeLineup = (teamId: string, teamName: string, playerPrefix: string): TeamLineup => ({
    teamId,
    teamName,
    formation: '4-2-3-1',
    formationSource: 'espn',
    starters: Array.from({ length: 11 }, (_, index) => ({
        name: `${teamName} ${playerPrefix}${index + 1}`,
        jersey: String(index + 1),
        position: index === 0 ? 'Goalkeeper' : 'Midfielder',
        positionGroup: index === 0 ? 'GK' : 'MID',
        formationPlace: index + 1
    })),
    bench: [],
    substitutions: []
});

describe('MatchLineups team navigation', () => {
    it('opens Fenerbahce first when the club is the home team', () => {
        const lineups: MatchLineupsData = {
            home: makeLineup('1', 'Fenerbahce', 'FB'),
            away: makeLineup('2', 'Rakip', 'R')
        };

        render(<MatchLineups lineups={lineups} homeTeamName="Fenerbahce" awayTeamName="Rakip" matchId="401888313" useSquadPhotos={false} />);

        expect(screen.getByRole('button', { name: 'Fenerbahçe' })).toHaveClass('bg-yellow-400');
        expect(screen.getByText('FB1')).toBeInTheDocument();
    });

    it('opens Fenerbahce first when the club is the away team and switches to the opponent', () => {
        const lineups: MatchLineupsData = {
            home: makeLineup('2', 'Rakip', 'R'),
            away: makeLineup('1', 'Fenerbahce', 'FB')
        };

        render(<MatchLineups lineups={lineups} homeTeamName="Rakip" awayTeamName="Fenerbahce" matchId="401888314" useSquadPhotos={false} />);

        const fenerTab = screen.getByRole('button', { name: 'Fenerbahçe' });
        const opponentTab = screen.getByRole('button', { name: 'Rakip' });
        expect(fenerTab).toHaveClass('bg-yellow-400');
        expect(screen.getByText('FB1')).toBeInTheDocument();

        fireEvent.click(opponentTab);
        expect(opponentTab).toHaveClass('bg-yellow-400');
        expect(screen.getByText('R1')).toBeInTheDocument();
    });

    it('renders the available team when one provider side is missing', () => {
        const lineups: MatchLineupsData = {
            home: null,
            away: makeLineup('1', 'Fenerbahce', 'FB')
        };

        render(<MatchLineups lineups={lineups} homeTeamName="Rakip" awayTeamName="Fenerbahce" matchId="401888315" useSquadPhotos={false} />);

        expect(screen.getByRole('button', { name: 'Fenerbahçe' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Rakip' })).not.toBeInTheDocument();
        expect(screen.getByText('FB1')).toBeInTheDocument();
    });

    it('normalizes a manual lineup when Firebase omits empty arrays', () => {
        const manualLineup: Partial<TeamLineup> = makeLineup('1', 'Fenerbahce', 'FB');
        delete manualLineup.bench;
        delete manualLineup.substitutions;

        const lineups = {
            home: null,
            away: manualLineup
        } as MatchLineupsData;

        render(<MatchLineups lineups={lineups} homeTeamName="Rakip" awayTeamName="Fenerbahce" matchId="401888316" useSquadPhotos={false} />);

        expect(screen.getByRole('button', { name: 'Fenerbahçe' })).toBeInTheDocument();
        expect(screen.getByText('FB1')).toBeInTheDocument();
    });
});
