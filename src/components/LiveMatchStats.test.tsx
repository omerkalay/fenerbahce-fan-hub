// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LiveMatchStats from './LiveMatchStats';

const fullStats = [
    { name: 'possessionPct', homeValue: '56%', awayValue: '44%' },
    { name: 'totalShots', homeValue: '14', awayValue: '10' },
    { name: 'shotsOnTarget', homeValue: '7', awayValue: '4' },
    { name: 'wonCorners', homeValue: '6', awayValue: '4' },
    { name: 'foulsCommitted', homeValue: '11', awayValue: '14' },
    { name: 'yellowCards', homeValue: '1', awayValue: '1' },
    { name: 'redCards', homeValue: '0', awayValue: '1' },
];

describe('LiveMatchStats', () => {
    it('uses split possession and one consistent mirrored comparison layout', () => {
        const { container } = render(<LiveMatchStats stats={fullStats} />);

        expect(screen.getByLabelText('Topla Oynama: 56% - 44%')).toHaveAttribute('data-stat-kind', 'possession');
        expect(screen.getByLabelText('Toplam Şut: 14 - 10')).toHaveAttribute('data-stat-kind', 'comparison');
        expect(screen.getByLabelText('Sarı Kart: 1 - 1')).toHaveAttribute('data-stat-kind', 'comparison');
        expect(screen.getByLabelText('Kırmızı Kart: 0 - 1')).toHaveAttribute('data-stat-kind', 'comparison');
        expect(container.querySelectorAll('[data-stat-kind="comparison"]')).toHaveLength(6);
        expect(screen.queryByRole('group', { name: 'Kart istatistikleri' })).not.toBeInTheDocument();
    });

    it('keeps the partial-data explanation when only one statistic is available', () => {
        render(<LiveMatchStats stats={[fullStats[0]]} />);

        expect(screen.getByText(/Bazı istatistikler henüz eksik/)).toBeInTheDocument();
        expect(screen.getByLabelText('Topla Oynama: 56% - 44%')).toBeInTheDocument();
    });

    it('explains ESPN zero placeholders while retaining independently available cards', () => {
        render(<LiveMatchStats stats={fullStats.map((stat) => ({
            ...stat,
            homeValue: stat.name === 'yellowCards' ? '4' : '0',
            awayValue: stat.name === 'yellowCards' ? '3' : '0',
        }))} />);

        expect(screen.getByText(/Sağlayıcı bu maçın şut, korner/)).toBeInTheDocument();
        expect(screen.queryByLabelText('Topla Oynama: 0 - 0')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Toplam Şut: 0 - 0')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Sarı Kart: 4 - 3')).toBeInTheDocument();
        expect(screen.getByLabelText('Kırmızı Kart: 0 - 0')).toBeInTheDocument();
    });

    it('preserves legitimate zero counts when possession coverage exists', () => {
        render(<LiveMatchStats stats={fullStats.map((stat) => stat.name === 'possessionPct'
            ? stat
            : { ...stat, homeValue: '0', awayValue: '0' })} />);

        expect(screen.getByLabelText('Toplam Şut: 0 - 0')).toBeInTheDocument();
        expect(screen.getByLabelText('Korner: 0 - 0')).toBeInTheDocument();
        expect(screen.queryByText(/Sağlayıcı bu maçın/)).not.toBeInTheDocument();
    });

    it('shows statistics that arrive after a placeholder response', () => {
        const { rerender } = render(<LiveMatchStats stats={fullStats.map((stat) => ({
            ...stat, homeValue: '0', awayValue: '0',
        }))} />);

        rerender(<LiveMatchStats stats={fullStats} />);

        expect(screen.getByLabelText('Toplam Şut: 14 - 10')).toBeInTheDocument();
        expect(screen.queryByText(/Sağlayıcı bu maçın/)).not.toBeInTheDocument();
    });

    it('does not discard supplied shot counts when possession alone is unavailable', () => {
        render(<LiveMatchStats stats={fullStats.map((stat) => stat.name === 'possessionPct'
            ? { ...stat, homeValue: '0', awayValue: '0' }
            : stat)} />);

        expect(screen.getByLabelText('Toplam Şut: 14 - 10')).toBeInTheDocument();
        expect(screen.queryByLabelText('Topla Oynama: 0 - 0')).not.toBeInTheDocument();
        expect(screen.getByText(/Bazı istatistikler henüz eksik/)).toBeInTheDocument();
    });
});
