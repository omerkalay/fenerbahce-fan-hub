import { auth } from '../firebase';
import { BACKEND_URL } from './api/base';
import type {
    AdminLineupSettings,
    FormationDraft,
    MatchData,
    PublishedMatchLineups
} from '../types';

export interface AdminLineupDetail {
    match: MatchData;
    detection: {
        status: 'observing' | 'ready' | 'idle';
        consecutiveSeen: number;
        firstSeenAt: number | null;
        lastSeenAt: number | null;
        payload: PublishedMatchLineups | null;
    } | null;
    published: PublishedMatchLineups | null;
    draft: FormationDraft | null;
    settings: AdminLineupSettings;
    manualLocked: boolean;
    notification: {
        status: string | null;
        acceptedAt: number | null;
        failedAt: number | null;
        errorCode: string | null;
    } | null;
}

const ADMIN_ERROR_MESSAGES: Record<number, string> = {
    400: 'Gönderilen bilgiler geçersiz.',
    401: 'Yönetici oturumu doğrulanamadı. Tekrar giriş yap.',
    403: 'Bu hesapta yönetici yetkisi yok.',
    404: 'İstenen yönetim kaydı bulunamadı.',
    405: 'Bu işlem desteklenmiyor.',
    409: 'İşlem mevcut durumla çakıştı. Paneli yenileyip tekrar dene.',
    429: 'Çok fazla istek gönderildi. Biraz bekleyip tekrar dene.'
};

const adminRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Yönetici hesabıyla giriş yapmalısın.');
    const idToken = await user.getIdToken();
    const response = await fetch(`${BACKEND_URL}/admin/${path.replace(/^\/+/, '')}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${idToken}`,
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(ADMIN_ERROR_MESSAGES[response.status] || 'Yönetim işlemi tamamlanamadı.');
    }
    return data as T;
};

export const fetchAdminSession = () => adminRequest<{ authenticated: true; admin: true; uid: string }>('session');
export const fetchAdminLineup = (matchId: number | string) => adminRequest<AdminLineupDetail>(`lineups/${matchId}`);

export const saveAdminLineupDraft = (matchId: number | string, draft: FormationDraft) => (
    adminRequest<{ success: true; draft: FormationDraft }>(`lineups/${matchId}/draft`, {
        method: 'PUT',
        body: JSON.stringify({ formation: draft.formation, players: draft.players })
    })
);

export const publishAdminLineup = (matchId: number | string, mode: 'detected' | 'manual') => (
    adminRequest<{ success: true; published: PublishedMatchLineups }>(`lineups/${matchId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ mode })
    })
);

export const releaseAdminLineup = (matchId: number | string) => (
    adminRequest<{ success: true; manualLocked: false }>(`lineups/${matchId}/release`, {
        method: 'POST',
        body: JSON.stringify({})
    })
);

export const updateAdminSettings = (settings: AdminLineupSettings) => (
    adminRequest<{ success: true; settings: AdminLineupSettings }>('settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    })
);
