// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SeasonSelector from './SeasonSelector';
import type { SeasonOption } from '../utils/seasons';

const options: SeasonOption[] = [
    { startYear: 2026, label: '2026/27', badge: 'Güncel' },
    { startYear: 2025, label: '2025/26' },
];

describe('SeasonSelector', () => {
    it('shows short fixture labels while preserving the numeric season value', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        render(
            <SeasonSelector
                value={2026}
                options={options}
                onChange={onChange}
                compact
            />
        );

        const select = screen.getByRole('combobox', { name: 'Sezon seç' });
        expect(select).toHaveValue('2026');
        expect(screen.getByRole('option', { name: '26/27' })).toHaveValue('2026');
        expect(screen.queryByRole('option', { name: '2026/27' })).not.toBeInTheDocument();

        await user.selectOptions(select, '2025');
        expect(onChange).toHaveBeenCalledWith(2025);
    });

    it('keeps full labels outside the compact fixture control', () => {
        render(
            <SeasonSelector
                value={2026}
                options={options}
                onChange={vi.fn()}
            />
        );

        expect(screen.getByRole('option', { name: '2026/27 (Güncel)' })).toBeInTheDocument();
    });
});
