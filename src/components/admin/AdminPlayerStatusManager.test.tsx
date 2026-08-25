// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AdminPlayerStatusManager from './AdminPlayerStatusManager';
import type { AdminPlayerStatusState } from '../../services/admin';

const emptyState: AdminPlayerStatusState = {
    published: [],
    draft: null,
    revision: 0,
    lastPublishedAt: null
};

const squad = [
    { id: 10, name: 'Test Player', position: 'Forward', number: 10, photo: 'https://example.com/player.png' }
];

describe('AdminPlayerStatusManager', () => {
    it('adds a squad player, edits status fields and saves only the draft callback', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const onPublish = vi.fn().mockResolvedValue(undefined);
        render(
            <AdminPlayerStatusManager
                state={emptyState}
                squad={squad}
                busy={false}
                onSave={onSave}
                onPublish={onPublish}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Oyuncu durumu ekle' }));
        fireEvent.click(screen.getByRole('button', { name: /Test Player/ }));
        fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'suspended' } });
        fireEvent.change(screen.getByLabelText('Açıklama (istersen düzenle)'), { target: { value: 'One match ban' } });
        fireEvent.click(screen.getByRole('button', { name: 'Taslağa ekle' }));
        fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave.mock.calls[0][0]).toEqual([
            expect.objectContaining({ playerId: '10', source: 'squad', name: 'Test Player', status: 'suspended', detail: 'One match ban', returnDate: '' })
        ]);
        expect(onPublish).not.toHaveBeenCalled();
    });

    it('removes only the local draft entry and displays the 14-day stale warning', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        const state: AdminPlayerStatusState = {
            published: [{
                playerId: '10',
                source: 'squad',
                name: 'Test Player',
                status: 'injured',
                detail: 'Ankle',
                returnDate: 'Two weeks',
                updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1000
            }],
            draft: null,
            revision: 2,
            lastPublishedAt: Date.now() - 15 * 24 * 60 * 60 * 1000
        };
        render(
            <AdminPlayerStatusManager
                state={state}
                squad={squad}
                busy={false}
                onSave={onSave}
                onPublish={vi.fn().mockResolvedValue(undefined)}
            />
        );

        expect(screen.getByText(/14 günden eski/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Test Player durumunu taslaktan çıkar' }));
        expect(screen.getByText(/Taslakta oyuncu yok/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));
        await waitFor(() => expect(onSave).toHaveBeenCalledWith([]));
    });

    it('supports a manual player fallback without accepting an empty name', () => {
        render(
            <AdminPlayerStatusManager
                state={emptyState}
                squad={[]}
                busy={false}
                onSave={vi.fn().mockResolvedValue(undefined)}
                onPublish={vi.fn().mockResolvedValue(undefined)}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Oyuncu durumu ekle' }));
        fireEvent.click(screen.getByRole('button', { name: /Listede olmayan oyuncuyu manuel ekle/ }));
        expect(screen.getByRole('button', { name: 'Taslağa ekle' })).toBeDisabled();
        fireEvent.change(screen.getByLabelText('Oyuncu'), { target: { value: 'Manual Player' } });
        expect(screen.getByRole('button', { name: 'Taslağa ekle' })).not.toBeDisabled();
    });

    it('offers status-specific description and estimated-return presets', async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(
            <AdminPlayerStatusManager
                state={emptyState}
                squad={squad}
                busy={false}
                onSave={onSave}
                onPublish={vi.fn().mockResolvedValue(undefined)}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Oyuncu durumu ekle' }));
        fireEvent.click(screen.getByRole('button', { name: /Test Player/ }));
        fireEvent.click(screen.getByRole('button', { name: 'Açıklama: Düşük kondisyon' }));
        fireEvent.click(screen.getByRole('button', { name: 'Tahmini dönüş: 2 hafta' }));
        fireEvent.click(screen.getByRole('button', { name: 'Taslağa ekle' }));
        fireEvent.click(screen.getByRole('button', { name: 'Taslağı kaydet' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledWith([
            expect.objectContaining({ status: 'injured', detail: 'Düşük kondisyon', returnDate: '2 hafta' })
        ]));
    });

    it('limits card-risk presets to 3, 7 and 11 yellow cards', () => {
        render(
            <AdminPlayerStatusManager
                state={emptyState}
                squad={squad}
                busy={false}
                onSave={vi.fn().mockResolvedValue(undefined)}
                onPublish={vi.fn().mockResolvedValue(undefined)}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Oyuncu durumu ekle' }));
        fireEvent.click(screen.getByRole('button', { name: /Test Player/ }));
        fireEvent.change(screen.getByLabelText('Durum'), { target: { value: 'card-risk' } });

        expect(screen.getByRole('button', { name: 'Açıklama: 3 sarı kart' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Açıklama: 7 sarı kart' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Açıklama: 11 sarı kart' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Açıklama: 15 sarı kart' })).not.toBeInTheDocument();
        expect(screen.queryByText('Hazır tahmini dönüş')).not.toBeInTheDocument();
    });
});
