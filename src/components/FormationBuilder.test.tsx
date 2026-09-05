// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FormationBuilder from './FormationBuilder';
import { FORMATION_STORAGE_KEY } from '../utils/formationStorage';

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
        localStorage.clear();
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

    it('restores formation and selected players after leaving and reopening the builder', async () => {
        const { unmount } = render(<FormationBuilder />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '4-3-3' } });
        fireEvent.click(screen.getAllByText('+')[0]);
        fireEvent.click(await screen.findByRole('button', { name: /1 Goalkeeper Goalkeeper/i }));
        await screen.findByRole('button', { name: 'Test Goalkeeper pozisyonundan çıkar' });
        unmount();

        render(<FormationBuilder />);
        expect(screen.getByRole('combobox')).toHaveValue('4-3-3');
        expect(screen.getByRole('button', { name: 'Test Goalkeeper pozisyonundan çıkar' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Temizle' }));
        await waitFor(() => expect(JSON.parse(localStorage.getItem(FORMATION_STORAGE_KEY)!).players).toEqual([]));
    });

    it('keeps the saved lineup on a squad failure and reconciles players by ID after recovery', async () => {
        localStorage.setItem(FORMATION_STORAGE_KEY, JSON.stringify({
            formation: '4-3-3', players: [
                { slot: 'GK', id: 1, name: 'Old Name', position: 'Goalkeeper', number: 1 },
                { slot: 'ST', id: 999, name: 'Departed Player', position: 'Forward', number: 9 },
            ],
        }));
        fetchSquadMock.mockResolvedValueOnce([]);
        const { unmount } = render(<FormationBuilder />);
        await waitFor(() => expect(fetchSquadMock).toHaveBeenCalledOnce());
        expect(screen.getByRole('button', { name: 'Old Name pozisyonundan çıkar' })).toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(FORMATION_STORAGE_KEY)!).players).toHaveLength(2);
        unmount();

        render(<FormationBuilder />);
        await screen.findByRole('button', { name: 'Test Goalkeeper pozisyonundan çıkar' });
        expect(screen.queryByRole('button', { name: 'Departed Player pozisyonundan çıkar' })).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem(FORMATION_STORAGE_KEY)!).players).toHaveLength(1);
    });

    it('does not read or overwrite the public draft in the administrator editor', async () => {
        const saved = JSON.stringify({ formation: '4-3-3', players: [] });
        localStorage.setItem(FORMATION_STORAGE_KEY, saved);
        render(<FormationBuilder adminMode />);
        await waitFor(() => expect(fetchSquadMock).toHaveBeenCalledOnce());
        expect(screen.getByRole('combobox')).toHaveValue('4-2-3-1');
        fireEvent.change(screen.getByRole('combobox'), { target: { value: '3-5-2' } });
        expect(localStorage.getItem(FORMATION_STORAGE_KEY)).toBe(saved);
    });

    it('opens safely when the saved draft is malformed', () => {
        localStorage.setItem(FORMATION_STORAGE_KEY, '{broken');
        render(<FormationBuilder />);
        expect(screen.getByRole('combobox')).toHaveValue('4-2-3-1');
    });
});
