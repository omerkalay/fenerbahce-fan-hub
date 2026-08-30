// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FormationBuilder from './FormationBuilder';

const CANONICAL_SLOTS = ['GK', 'RB', 'LB', 'CDM1', 'CB2', 'CB1', 'RAM', 'CDM2', 'ST', 'CAM', 'LAM'];
const squad = CANONICAL_SLOTS.map((slot, index) => ({
    id: index + 1,
    name: index === 0 ? 'Test Goalkeeper' : `Test Player ${index + 1}`,
    position: index === 0 ? 'Goalkeeper' : 'Midfielder',
    number: index + 1,
    slot
}));

const { fetchSquadMock } = vi.hoisted(() => ({
    fetchSquadMock: vi.fn()
}));

vi.mock('../services/api', () => ({ fetchSquad: fetchSquadMock }));

describe('FormationBuilder touch editing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchSquadMock.mockResolvedValue(squad);
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

    it('serializes a restored manual draft in canonical wire order', async () => {
        const onDraftChange = vi.fn();
        const initialDraft = {
            formation: '4-2-3-1' as const,
            players: [...squad].reverse().map((player) => ({
                slot: player.slot,
                id: player.id,
                name: player.name,
                position: player.position,
                number: player.number
            }))
        };

        render(
            <FormationBuilder
                adminMode
                initialDraft={initialDraft}
                onDraftChange={onDraftChange}
            />
        );

        await waitFor(() => {
            const latestCall = onDraftChange.mock.calls[onDraftChange.mock.calls.length - 1];
            const latestDraft = latestCall?.[0];
            expect(latestDraft?.players).toHaveLength(11);
            expect(latestDraft.players.map((player: { slot: string }) => player.slot)).toEqual(CANONICAL_SLOTS);
        });
    });
});
