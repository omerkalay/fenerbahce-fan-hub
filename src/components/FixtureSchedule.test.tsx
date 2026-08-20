// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FixtureMatch } from '../types';
import { FixtureMatchCard } from './FixtureSchedule';
import { COMPETITION_FILTERS } from './fixtureFilters';

vi.mock('../services/api', () => ({
    BACKEND_URL: 'https://test.example.com/api',
    fetchFenerbahceFixtures: vi.fn(),
    fetchMatchSummary: vi.fn()
}));

const cupFixture: FixtureMatch = {
    id: '987',
    source: 'sofascore',
    summaryAvailable: false,
    date: '2026-12-16T17:30:00Z',
    timeValid: true,
    competitionName: 'Türkiye Kupası',
    competitionKey: 'turkiye-kupasi',
    competitionGroup: 'cup',
    competitionLabel: 'Türkiye Kupası',
    roundLabel: '5. Tur',
    venueName: null,
    venueCity: null,
    status: { state: 'post', completed: true, description: 'Ended', detail: 'FT', shortDetail: 'FT' },
    homeTeam: { id: '3052', name: 'Fenerbahçe', shortName: 'Fenerbahçe', abbreviation: 'FEN', logo: null, score: '2', winner: true },
    awayTeam: { id: '999', name: 'Beşiktaş', shortName: 'Beşiktaş', abbreviation: 'BES', logo: null, score: '1', winner: false },
    isFbHome: true,
    fbTeam: { id: '3052', name: 'Fenerbahçe', shortName: 'Fenerbahçe', abbreviation: 'FEN', logo: null, score: '2', winner: true },
    opponentTeam: { id: '999', name: 'Beşiktaş', shortName: 'Beşiktaş', abbreviation: 'BES', logo: null, score: '1', winner: false },
    resultCode: 'G',
    resultLabel: 'Galibiyet'
};

describe('FixtureSchedule competition UI', () => {
    it('exposes a full-name cup filter', () => {
        expect(COMPETITION_FILTERS).toContainEqual({ id: 'cup', label: 'Türkiye Kupası' });
    });

    it('shows the competition label but hides the unsupported summary action', () => {
        const onOpenSummary = vi.fn();
        render(<FixtureMatchCard match={cupFixture} onOpenSummary={onOpenSummary} />);

        const competitionLabel = screen.getByTitle('Türkiye Kupası');
        const fullDate = screen.getByText('16 Aralık 2026');

        expect(competitionLabel).toBeInTheDocument();
        expect(competitionLabel.compareDocumentPosition(fullDate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(competitionLabel).toHaveClass('truncate');
        expect(fullDate.parentElement).toHaveClass('whitespace-nowrap');
        expect(screen.getByText('5. Tur')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Maç İstatistikleri/i })).not.toBeInTheDocument();
    });

    it('renders European competition labels in white', () => {
        const europeanFixture: FixtureMatch = {
            ...cupFixture,
            id: 'uefa-123',
            source: 'espn',
            summaryAvailable: true,
            competitionName: 'UEFA Şampiyonlar Ligi Elemeleri',
            competitionKey: 'uefa.champions_qual',
            competitionGroup: 'europe',
            competitionLabel: 'UEFA Şampiyonlar Ligi Elemeleri',
        };

        render(<FixtureMatchCard match={europeanFixture} />);

        expect(screen.getByTitle('UEFA Şampiyonlar Ligi Elemeleri')).toHaveClass('text-white');
    });
});
