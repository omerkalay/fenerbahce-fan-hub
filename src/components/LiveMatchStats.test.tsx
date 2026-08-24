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
});
