// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FormationBuilder from './FormationBuilder';

const { fetchSquadMock } = vi.hoisted(() => ({
    fetchSquadMock: vi.fn().mockResolvedValue([
        { id: 1, name: 'Test Goalkeeper', position: 'Goalkeeper', number: 1 }
    ])
}));

vi.mock('../services/api', () => ({ fetchSquad: fetchSquadMock }));

describe('FormationBuilder touch editing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 1 });
    });

    it('lets a touch user fill a pitch slot by tapping and reports the admin draft', async () => {
        const onDraftChange = vi.fn();
        render(<FormationBuilder adminMode onDraftChange={onDraftChange} />);

        fireEvent.click(screen.getAllByText('+')[0]);
        expect(screen.getByRole('dialog', { name: 'Oyuncu Seç' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Oyuncular' })).not.toBeInTheDocument();

        fireEvent.click(await screen.findByRole('button', { name: /1 Goalkeeper Goalkeeper/i }));

        await waitFor(() => {
            expect(onDraftChange).toHaveBeenLastCalledWith(expect.objectContaining({
                formation: '4-2-3-1',
                players: [expect.objectContaining({ id: 1, number: 1 })]
            }));
        });
        const removeButton = screen.getByRole('button', { name: 'Test Goalkeeper pozisyonundan çıkar' });
        expect(removeButton.parentElement).toHaveAttribute('draggable', 'false');
    });
});
