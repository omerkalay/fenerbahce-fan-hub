// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DashboardStandingsPanel from './DashboardStandingsPanel';

vi.mock('../services/api', () => ({
    fetchUefaJourneySummary: vi.fn().mockResolvedValue(null),
}));

describe('DashboardStandingsPanel', () => {
    it('uses the concise Lig ve Avrupa heading', () => {
        render(
            <DashboardStandingsPanel
                onOpen={vi.fn()}
                seasonStartYear={2026}
            />
        );

        expect(screen.getByRole('heading', { name: 'Lig ve Avrupa' })).toBeInTheDocument();
    });
});
