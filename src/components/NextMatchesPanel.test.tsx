// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchData } from '../types';
import NextMatchesPanel from './NextMatchesPanel';

vi.mock('../services/api', () => ({
    BACKEND_URL: 'https://test.example.com/api'
}));

describe('NextMatchesPanel minimal match rows', () => {
    it('keeps a cup fixture compact while localizing the team names', () => {
        const match: MatchData = {
            id: 987,
            startTimestamp: Date.UTC(2026, 11, 16, 17, 30) / 1000,
            homeTeam: { id: 3052, name: 'Fenerbahce' },
            awayTeam: { id: 999, name: 'Besiktas' },
            tournament: { name: 'Türkiye Kupası', uniqueTournament: { id: 96, name: 'Türkiye Kupası' } }
        };

        render(<NextMatchesPanel next3Matches={[match]} />);

        expect(screen.queryByText('Türkiye Kupası')).not.toBeInTheDocument();
        expect(screen.getByText('Fenerbahçe')).toBeInTheDocument();
        expect(screen.getByText('Beşiktaş')).toBeInTheDocument();
        expect(screen.getByText('16 Ara')).toBeInTheDocument();
    });
});
