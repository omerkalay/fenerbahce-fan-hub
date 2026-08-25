// @vitest-environment happy-dom
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MatchSummaryModal from './MatchSummaryModal';
import type { FixtureMatch, MatchSummaryData } from '../types';

vi.mock('./MatchLineups', () => ({ default: () => <div>Ortak kadro görünümü</div> }));

const finishedMatch: FixtureMatch = {
    id: 'match-1',
    source: 'espn',
    summaryAvailable: true,
    date: '2026-08-22T18:30:00Z',
    timeValid: true,
    competitionName: 'Süper Lig',
    competitionKey: 'tur.1',
    competitionGroup: 'superlig',
    competitionLabel: 'Süper Lig',
    roundLabel: null,
    venueName: null,
    venueCity: null,
    status: { state: 'post', completed: true, description: 'Ended', detail: 'FT', shortDetail: 'FT' },
    homeTeam: {
        id: 'home',
        name: 'Fenerbahçe Spor Kulübü Çok Uzun',
        shortName: 'Fenerbahçe',
        abbreviation: 'FB',
        logo: null,
        score: '4',
        winner: true,
    },
    awayTeam: {
        id: 'away',
        name: 'Konyaspor',
        shortName: 'Konyaspor',
        abbreviation: 'KON',
        logo: null,
        score: '2',
        winner: false,
    },
    isFbHome: true,
    fbTeam: {
        id: 'home',
        name: 'Fenerbahçe',
        shortName: 'Fenerbahçe',
        abbreviation: 'FB',
        logo: null,
        score: '4',
        winner: true,
    },
    opponentTeam: {
        id: 'away',
        name: 'Konyaspor',
        shortName: 'Konyaspor',
        abbreviation: 'KON',
        logo: null,
        score: '2',
        winner: false,
    },
    resultCode: 'G',
    resultLabel: 'Galibiyet',
};

const summaryData: MatchSummaryData = {
    homeTeam: { id: 'home', name: finishedMatch.homeTeam.name, score: '4' },
    awayTeam: { id: 'away', name: finishedMatch.awayTeam.name, score: '2' },
    statusDetail: 'FT',
    events: [
        { clock: '18', player: 'Golcü', team: 'home', type: 'Goal', isGoal: true, assist: 'Asistçi' },
    ],
    stats: [
        { name: '', key: 'possessionPct', homeValue: '56%', awayValue: '44%' },
        { name: '', key: 'totalShots', homeValue: '14', awayValue: '10' },
        { name: '', key: 'shotsOnTarget', homeValue: '7', awayValue: '4' },
    ],
    lineups: null,
};

const SummaryHarness = () => {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Özeti aç</button>
            <MatchSummaryModal
                activeSummaryMatch={open ? finishedMatch : null}
                activeSummaryData={open ? summaryData : null}
                summaryLoading={false}
                summaryError={null}
                summaryHomeLogo={null}
                summaryAwayLogo={null}
                seasonStartYear={2026}
                onClose={() => setOpen(false)}
            />
        </>
    );
};

describe('MatchSummaryModal', () => {
    it('opens the shared match center on statistics and supports every detail tab', async () => {
        const user = userEvent.setup();
        render(<SummaryHarness />);

        const trigger = screen.getByRole('button', { name: 'Özeti aç' });
        await user.click(trigger);

        expect(screen.getByRole('dialog', { name: 'Maç Merkezi' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Maç merkezini kapat' })).toHaveFocus();
        expect(screen.getByRole('tab', { name: 'İstatistikler' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText('Toplam Şut: 14 - 10')).toBeInTheDocument();
        expect(screen.getByText(finishedMatch.homeTeam.name)).toHaveClass('line-clamp-2');

        await user.click(screen.getByRole('tab', { name: 'Olaylar' }));
        expect(screen.getByText('Asist: Asistçi')).toBeInTheDocument();

        await user.click(screen.getByRole('tab', { name: 'Kadrolar' }));
        expect(screen.getByText('İlk 11 bilgisi henüz paylaşılmadı')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog', { name: 'Maç Merkezi' })).not.toBeInTheDocument();
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it('keeps explicit loading and error states inside the accessible dialog', () => {
        const { rerender } = render(
            <MatchSummaryModal
                activeSummaryMatch={finishedMatch}
                activeSummaryData={null}
                summaryLoading
                summaryError={null}
                summaryHomeLogo={null}
                summaryAwayLogo={null}
                onClose={() => undefined}
            />
        );

        expect(screen.getByLabelText('Maç özeti yükleniyor')).toBeInTheDocument();

        rerender(
            <MatchSummaryModal
                activeSummaryMatch={finishedMatch}
                activeSummaryData={null}
                summaryLoading={false}
                summaryError="Bu maç için istatistik özeti henüz hazır değil."
                summaryHomeLogo={null}
                summaryAwayLogo={null}
                onClose={() => undefined}
            />
        );

        expect(screen.getByText('Bu maç için istatistik özeti henüz hazır değil.')).toBeInTheDocument();
    });
});
