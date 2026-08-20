// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UefaJourneyPayload } from '../types';
import StandingsModal from './StandingsModal';
import { fetchUefaJourney } from '../services/api';

vi.mock('../services/api', () => ({
    fetchUefaJourney: vi.fn(),
    fetchEspnStandings: vi.fn()
}));

vi.mock('./CustomStandings', () => ({
    default: () => <div>UEFA tablosu</div>
}));

const champions = {
    key: 'champions' as const,
    name: 'UEFA Şampiyonlar Ligi',
    shortName: 'Şampiyonlar Ligi',
    mainSlug: 'uefa.champions',
    qualifierSlug: 'uefa.champions_qual',
    qualifierName: 'UEFA Şampiyonlar Ligi Elemeleri'
};

const payload = (mainCompetition: boolean): UefaJourneyPayload => ({
    source: 'ESPN',
    seasonStartYear: 2026,
    lastUpdate: 1,
    stale: false,
    participation: {
        state: mainCompetition ? 'league_phase' : 'qualifying',
        competition: mainCompetition ? champions : null,
        qualifier: champions,
        phaseLabel: mainCompetition ? 'Lig Aşaması' : 'Eleme Play-off Turu'
    },
    standings: mainCompetition ? {
        id: 'champions',
        name: 'UEFA Şampiyonlar Ligi',
        rows: []
    } : null,
    fenerPath: [],
    bracket: mainCompetition ? { competition: champions, stages: [] } : null
});
describe('StandingsModal UEFA journey', () => {
    beforeEach(() => {
        vi.mocked(fetchUefaJourney).mockReset();
    });

    it('keeps the Super Lig table in its compact mobile modal', () => {
        render(
            <StandingsModal
                visible
                league="superlig"
                initialSeasonStartYear={2026}
                onClose={vi.fn()}
            />
        );

        const surface = screen.getByTestId('standings-modal-surface');
        expect(surface).toHaveAttribute('data-mobile-layout', 'compact');
        expect(surface).toHaveClass('max-h-[88vh]', 'rounded-2xl');
        expect(surface).not.toHaveClass('h-[100dvh]');
    });

    it('stays generic during qualifying and shows the current route in plain text', async () => {
        vi.mocked(fetchUefaJourney).mockResolvedValue(payload(false));

        render(
            <StandingsModal
                visible
                league="uefa"
                initialSeasonStartYear={2026}
                onClose={vi.fn()}
            />
        );

        expect(await screen.findByText('Avrupa Yolculuğu')).toBeInTheDocument();
        const surface = screen.getByTestId('standings-modal-surface');
        expect(surface).toHaveAttribute('data-mobile-layout', 'fullscreen');
        expect(surface).toHaveClass('h-[100dvh]', 'sm:h-[90vh]');
        expect(surface).not.toHaveClass('sm:h-auto');
        expect(screen.getByText('UEFA Şampiyonlar Ligi Elemeleri · Eleme Play-off Turu')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: "Fener’in Yolu" })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Puan Durumu' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Turnuva Ağacı' })).not.toBeInTheDocument();
    });

    it('uses the exact competition and exposes standings and bracket after qualification', async () => {
        vi.mocked(fetchUefaJourney).mockResolvedValue(payload(true));

        render(
            <StandingsModal
                visible
                league="uefa"
                initialSeasonStartYear={2026}
                onClose={vi.fn()}
            />
        );

        expect(await screen.findByText('UEFA Şampiyonlar Ligi')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Puan Durumu' })).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Turnuva Ağacı' })).toBeInTheDocument();
        expect(screen.getByText('UEFA tablosu')).toBeInTheDocument();
    });
});
