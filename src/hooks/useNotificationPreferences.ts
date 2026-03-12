import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { BACKEND_URL } from '../services/api';
import type { NotificationOptions } from '../types';
import {
    createEmptyOptions,
    normalizeOptions,
    countEnabledOptions,
    countMatchOptions,
    acquireFcmToken
} from '../utils/notificationHelpers';
import {
    loadSavedOptions,
    loadHasNotifications,
    persistOptions,
    clearNotificationStorage,
    loadFcmToken,
    persistFcmToken,
    clearFcmToken
} from '../utils/notificationStorage';
import useNotificationTokenSync from './useNotificationTokenSync';

export interface NotificationPreferencesState {
    selectedOptions: NotificationOptions;
    draftOptions: NotificationOptions | null;
    currentDraftOptions: NotificationOptions;
    hasDraftChanges: boolean;
    draftMatchCount: number;
    draftGeneralCount: number;
    hasActiveNotifications: boolean;
    isSaving: boolean;
    toggleOption: (optionId: keyof NotificationOptions) => void;
    openDraft: () => void;
    closeDraft: () => void;
    saveNotifications: () => Promise<boolean>;
}

const useNotificationPreferences = (user: User | null): NotificationPreferencesState => {
    const [isSaving, setIsSaving] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState<NotificationOptions>(loadSavedOptions);
    const [draftOptions, setDraftOptions] = useState<NotificationOptions | null>(null);
    const [hasActiveNotifications, setHasActiveNotifications] = useState(loadHasNotifications);

    // Load server preferences when user changes
    useEffect(() => {
        const abortController = new AbortController();

        const clearLocalState = () => {
            setSelectedOptions(createEmptyOptions());
            setDraftOptions(null);
            setHasActiveNotifications(false);
            clearNotificationStorage();
        };

        const loadServerPreferences = async () => {
            if (!user) {
                clearLocalState();
                return;
            }

            try {
                const idToken = await user.getIdToken();
                const response = await fetch(`${BACKEND_URL}/reminder`, {
                    headers: {
                        Authorization: `Bearer ${idToken}`
                    },
                    signal: abortController.signal
                });

                if (response.status === 404) {
                    clearLocalState();
                    return;
                }

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                const result = await response.json();

                // Guard: don't update state if effect was cleaned up during async work
                if (abortController.signal.aborted) return;

                const serverOptions = normalizeOptions(result.options);
                const enabledCount = countEnabledOptions(serverOptions);

                setSelectedOptions(serverOptions);
                setDraftOptions(null);
                setHasActiveNotifications(enabledCount > 0);
                persistOptions(serverOptions, enabledCount > 0);

                if (result.fcmToken) {
                    persistFcmToken(result.fcmToken);
                } else {
                    clearFcmToken();
                }
            } catch (err) {
                if ((err as Error).name === 'AbortError') return;
                console.error('Notification preferences load error:', err);
            }
        };

        loadServerPreferences();

        return () => { abortController.abort(); };
    }, [user]);

    // FCM token sync
    useNotificationTokenSync(hasActiveNotifications, user);

    const toggleOption = (optionId: keyof NotificationOptions) => {
        setDraftOptions((previous) => {
            const base = previous ?? selectedOptions;
            return {
                ...base,
                [optionId]: !base?.[optionId]
            };
        });
    };

    const openDraft = () => {
        setDraftOptions({ ...selectedOptions });
    };

    const closeDraft = () => {
        setDraftOptions(null);
    };

    const currentDraftOptions = draftOptions ?? selectedOptions;
    const hasDraftChanges = JSON.stringify(currentDraftOptions) !== JSON.stringify(selectedOptions);
    const draftMatchCount = countMatchOptions(currentDraftOptions);
    const draftGeneralCount = currentDraftOptions.generalNotifications ? 1 : 0;

    const saveNotifications = async (): Promise<boolean> => {
        if (isSaving) return false;

        setIsSaving(true);
        const optionsToSave = normalizeOptions(currentDraftOptions);
        const count = Object.entries(optionsToSave).filter(([key, value]) => key !== 'updatedAt' && value).length;
        const isDisablingAll = count === 0;
        const previousToken = loadFcmToken();
        let token = previousToken;

        try {
            if (!isDisablingAll) {
                try {
                    if (!('Notification' in window)) {
                        alert('Bu tarayıcı bildirimleri desteklemiyor.');
                        return false;
                    }

                    const permission = await Notification.requestPermission();
                    if (permission !== 'granted') {
                        alert('Bildirim izni reddedildi! Tarayıcı ayarlarından izin vermelisiniz.');
                        return false;
                    }

                    token = await acquireFcmToken();
                    if (!token) {
                        throw new Error('Firebase Messaging başlatılamadı');
                    }
                } catch (err) {
                    console.error('Token alınamadı:', err);
                    alert(`Bildirim hatası: ${(err as Error).message}`);
                    return false;
                }
            }

            let topicSyncPending = false;
            if (user && (token || isDisablingAll)) {
                const oldFcmToken = previousToken && previousToken !== token ? previousToken : undefined;
                const idToken = await user.getIdToken();
                const response = await fetch(`${BACKEND_URL}/reminder`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        ...(token ? { fcmToken: token, oldFcmToken } : {}),
                        options: optionsToSave
                    })
                });

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                const result = await response.json();
                console.log('Backend response:', result);
                topicSyncPending = !!result.topicSyncPending;

                if (token && token !== previousToken) {
                    persistFcmToken(token);
                }
            } else if (!isDisablingAll) {
                alert('Bildirim tokeni alınamadı. Lütfen tekrar deneyin.');
                return false;
            }

            const syncNote = topicSyncPending ? '\nGenel bildirim senkronu otomatik tekrar denenecek.' : '';
            if (count === 0) {
                setHasActiveNotifications(false);
                persistOptions(optionsToSave, false);
                alert('Tüm bildirimler temizlendi!' + syncNote);
            } else {
                setHasActiveNotifications(true);
                persistOptions(optionsToSave, true);
                alert(`${count} bildirim ayarlandı!` + syncNote);
            }

            setSelectedOptions(optionsToSave);
            setDraftOptions(null);
            return true;
        } catch (saveError) {
            console.error('Bildirim kaydetme hatası:', saveError);
            alert('Bağlantı hatası! Lütfen tekrar deneyin.');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    return {
        selectedOptions,
        draftOptions,
        currentDraftOptions,
        hasDraftChanges,
        draftMatchCount,
        draftGeneralCount,
        hasActiveNotifications,
        isSaving,
        toggleOption,
        openDraft,
        closeDraft,
        saveNotifications
    };
};

export default useNotificationPreferences;
