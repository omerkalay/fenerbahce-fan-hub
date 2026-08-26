// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminNotificationManager from './AdminNotificationManager';

const mocks = vi.hoisted(() => ({
    fetchAdminNotificationGroups: vi.fn(),
    fetchAdminNotificationUsers: vi.fn(),
    createAdminNotificationGroup: vi.fn(),
    updateAdminNotificationGroup: vi.fn(),
    deleteAdminNotificationGroup: vi.fn(),
    sendAdminNotificationTest: vi.fn(),
    sendAdminNotificationBroadcast: vi.fn()
}));

vi.mock('../../services/admin', () => mocks);
vi.mock('../PlayerImage', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt.slice(0, 1)}</span>
}));

const directory = {
    users: [
        {
            id: 'friend-a',
            displayName: 'Ali Taraftar',
            maskedEmail: 'a***@example.com',
            photoURL: null,
            disabled: false,
            notificationStatus: 'eligible' as const,
            eligible: true
        },
        {
            id: 'friend-b',
            displayName: 'Bildirim Kapalı',
            maskedEmail: 'b***@example.com',
            photoURL: null,
            disabled: false,
            notificationStatus: 'opted_out' as const,
            eligible: false
        }
    ],
    nextPageToken: null
};

describe('AdminNotificationManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchAdminNotificationGroups.mockResolvedValue({ groups: [] });
        mocks.fetchAdminNotificationUsers.mockResolvedValue(directory);
        mocks.sendAdminNotificationTest.mockResolvedValue({
            success: true,
            status: 'accepted',
            testId: '550e8400-e29b-41d4-a716-446655440000',
            expiresAt: Date.now() + 600_000
        });
        mocks.sendAdminNotificationBroadcast.mockResolvedValue({
            success: true,
            status: 'accepted',
            audience: { type: 'users' },
            delivery: { requested: 1, eligible: 1, accepted: 1, failed: 0, skipped: 0 }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads the protected directory only on demand and invalidates a test after content changes', async () => {
        render(<AdminNotificationManager />);
        await waitFor(() => expect(mocks.fetchAdminNotificationGroups).toHaveBeenCalledTimes(1));
        expect(mocks.fetchAdminNotificationUsers).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Kullanıcı seç' }));
        fireEvent.click(screen.getByRole('button', { name: 'Kullanıcıları seç' }));
        expect(await screen.findByText('Ali Taraftar')).toBeInTheDocument();
        expect(mocks.fetchAdminNotificationUsers).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Tüm taraftarlar' }));
        expect(screen.queryByPlaceholderText('Ad veya maskeli e-posta ile filtrele')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Kullanıcı seç' }));
        fireEvent.click(screen.getByRole('button', { name: 'Kullanıcıları seç' }));
        expect(screen.getByText('Ali Taraftar')).toBeInTheDocument();
        expect(mocks.fetchAdminNotificationUsers).toHaveBeenCalledTimes(1);

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[1]).toBeDisabled();
        fireEvent.click(checkboxes[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Seçimi kullan' }));

        fireEvent.change(screen.getByLabelText('Başlık'), { target: { value: 'Maç başladı' } });
        fireEvent.change(screen.getByLabelText('Mesaj'), { target: { value: 'Resmî paylaşımı aç.' } });
        fireEvent.change(screen.getByLabelText('Bağlantı'), { target: { value: 'https://x.com/Fenerbahce/status/123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Önce bana test gönder' }));

        await waitFor(() => expect(mocks.sendAdminNotificationTest).toHaveBeenCalledWith(expect.objectContaining({
            audience: { type: 'users', userUids: ['friend-a'] },
            url: 'https://x.com/Fenerbahce/status/123456'
        })));
        const sendButton = screen.getByRole('button', { name: 'Seçili hedefe gönder' });
        await waitFor(() => expect(sendButton).not.toBeDisabled());

        fireEvent.change(screen.getByLabelText('Mesaj'), { target: { value: 'İçerik değişti.' } });
        await waitFor(() => expect(sendButton).toBeDisabled());

        vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
        fireEvent.click(screen.getByRole('button', { name: 'Önce bana test gönder' }));
        await waitFor(() => expect(sendButton).not.toBeDisabled());
        fireEvent.click(sendButton);
        await waitFor(() => expect(mocks.sendAdminNotificationBroadcast).toHaveBeenCalledWith(expect.objectContaining({
            body: 'İçerik değişti.',
            audience: { type: 'users', userUids: ['friend-a'] }
        }), '550e8400-e29b-41d4-a716-446655440000'));
        expect(await screen.findByText('Gönderim tamamlandı: 1 kabul, 0 hata, 0 atlandı.')).toBeInTheDocument();
    });

    it('creates and removes a saved group with eligible selected users', async () => {
        const createdGroup = {
            id: '550e8400-e29b-41d4-a716-446655440000',
            name: 'Maç ekibi',
            userUids: ['friend-a'],
            revision: 1,
            createdAt: 100,
            updatedAt: 100
        };
        mocks.createAdminNotificationGroup.mockResolvedValue({ success: true, group: createdGroup });
        mocks.deleteAdminNotificationGroup.mockResolvedValue({ success: true });
        vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

        render(<AdminNotificationManager />);
        fireEvent.click(await screen.findByRole('button', { name: 'Yeni grup' }));
        expect(await screen.findByText('Ali Taraftar')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Grup adı'), { target: { value: 'Maç ekibi' } });
        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        fireEvent.click(screen.getByRole('button', { name: 'Grubu kaydet' }));

        await waitFor(() => expect(mocks.createAdminNotificationGroup).toHaveBeenCalledWith('Maç ekibi', ['friend-a']));
        expect(await screen.findByText('Bildirim grubu kaydedildi.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
        await waitFor(() => expect(mocks.deleteAdminNotificationGroup).toHaveBeenCalledWith(createdGroup));
        expect(await screen.findByText('Bildirim grubu silindi.')).toBeInTheDocument();
    });
});
