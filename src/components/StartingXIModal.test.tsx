// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PublishedMatchLineups } from '../types';
import StartingXIModal from './StartingXIModal';

vi.mock('./MatchLineups', () => ({
    default: ({ useSquadPhotos, embedded }: { useSquadPhotos?: boolean; embedded?: boolean }) => (
        <div data-testid="lineup-mode">{`${String(useSquadPhotos)}:${String(embedded)}`}</div>
    ),
}));

const data: PublishedMatchLineups = {
    matchId: 'mock-match',
    espnEventId: 'mock-event',
    league: 'mock-league',
    homeTeam: { id: '3052', name: 'Fenerbahçe', logo: '' },
    awayTeam: { id: '167', name: 'Olympique Lyonnais', logo: '' },
    lineups: { home: null, away: null },
    sources: { home: 'espn', away: 'espn' },
    publishedAt: 1,
    updatedAt: 1,
};

describe('StartingXIModal simulation presentation', () => {
    it('labels local simulation data honestly and disables squad photos', () => {
        render(
            <StartingXIModal
                visible
                data={data}
                onClose={vi.fn()}
                isSimulation
                useSquadPhotos={false}
            />
        );

        expect(screen.getByText('Simülasyon İlk 11’i')).toBeInTheDocument();
        expect(screen.getByText('Kaynak: Yerel geliştirme verisi')).toBeInTheDocument();
        expect(screen.getByTestId('lineup-mode')).toHaveTextContent('false:true');
        expect(screen.queryByText('Kaynak: ESPN')).not.toBeInTheDocument();
    });

    it('labels a one-sided manual Fenerbahce lineup without naming the missing opponent lineup', () => {
        render(
            <StartingXIModal
                visible
                data={{
                    ...data,
                    homeTeam: { id: '167', name: 'Olympique Lyonnais', logo: '' },
                    awayTeam: { id: '3052', name: 'Fenerbahçe', logo: '' },
                    lineups: {
                        home: null,
                        away: {
                            teamId: '3052',
                            teamName: 'Fenerbahçe',
                            formation: '4-2-3-1',
                            formationSource: 'manual',
                            starters: [],
                            bench: [],
                            substitutions: []
                        }
                    },
                    sources: { home: 'espn', away: 'manual' }
                }}
                onClose={vi.fn()}
            />
        );

        expect(screen.getByText('Fenerbahçe İlk 11’i')).toBeInTheDocument();
        expect(screen.getByText('Kaynak: Yönetim paneli')).toBeInTheDocument();
        expect(screen.queryByText(/Olympique Lyonnais/)).not.toBeInTheDocument();
    });
});
