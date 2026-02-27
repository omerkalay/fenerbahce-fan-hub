import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/api';

const FCM_TOKEN_STORAGE_KEY = 'fb_fcm_token';

const createEmptyOptions = () => ({
    threeHours: false,
    oneHour: false,
    thirtyMinutes: false,
    fifteenMinutes: false,
    dailyCheck: false
});

const normalizeOptions = (options = {}) => ({
    ...createEmptyOptions(),
    ...options
});

const NotificationSettings = () => {
    const [showModal, setShowModal] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState(() => {
        const saved = localStorage.getItem('fb_notification_options');
        if (saved) {
            try {
                return normalizeOptions(JSON.parse(saved));
            } catch {
                return createEmptyOptions();
            }
        }
        return createEmptyOptions();
    });
    const [draftOptions, setDraftOptions] = useState(null);
    const [hasActiveNotifications, setHasActiveNotifications] = useState(() => {
        const saved = localStorage.getItem('fb_has_notifications');
        return saved === 'true';
    });

    // Modal açıkken arka plan scroll'unu engelle
    useEffect(() => {
        if (showModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showModal]);

    // FCM token sync: SW + token gecerliligi kontrol et, degismisse backend'e bildir
    useEffect(() => {
        if (!hasActiveNotifications) return;

        const syncToken = async () => {
            try {
                if (!('Notification' in window) || Notification.permission !== 'granted') return;
                if (!('serviceWorker' in navigator)) return;

                const { messaging } = await import('../firebase');
                const { getToken } = await import('firebase/messaging');
                if (!messaging) return;

                const swUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
                const fcmScope = `${import.meta.env.BASE_URL}firebase-cloud-messaging-push-scope`;

                let registration = await navigator.serviceWorker.getRegistration(fcmScope);
                if (!registration) {
                    registration = await navigator.serviceWorker.register(swUrl, { scope: fcmScope });
                }

                const currentToken = await getToken(messaging, {
                    vapidKey: 'BL36u1e0V4xvIyP8n_Nh1Uc_EZTquN1vNv58E3wm_q3IsQ916MfhsbF1NATwfeoitmAIyhMTC5TdhB7CSBRAz-4',
                    serviceWorkerRegistration: registration
                });

                if (!currentToken) return;

                const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
                if (currentToken === storedToken) return;

                localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);

                const savedOptions = localStorage.getItem('fb_notification_options');
                if (!savedOptions) return;

                const options = normalizeOptions(JSON.parse(savedOptions));
                await fetch(`${BACKEND_URL}/reminder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerId: currentToken,
                        oldPlayerId: storedToken || undefined,
                        options
                    })
                });
            } catch (err) {
                console.error('FCM token sync error:', err);
            }
        };

        syncToken();
    }, [hasActiveNotifications]);

    const toggleOption = (optionId) => {
        setDraftOptions(prev => {
            const base = prev ?? selectedOptions;
            return {
                ...base,
                [optionId]: !base?.[optionId]
            };
        });
    };

    const handleOpenModal = () => {
        setDraftOptions({ ...selectedOptions });
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setDraftOptions(null);
        setShowModal(false);
    };

    const saveNotifications = async () => {
        const optionsToSave = normalizeOptions(currentDraftOptions);
        const count = Object.entries(optionsToSave).filter(([k, v]) => v && k !== 'updatedAt').length;
        const isDisablingAll = count === 0;
        const previousToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        let token = previousToken;

        try {
            if (!isDisablingAll) {
                try {
                    if (!('Notification' in window)) {
                        alert('❌ Bu tarayıcı bildirimleri desteklemiyor.');
                        return;
                    }

                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                        const { messaging } = await import('../firebase');
                        const { getToken } = await import('firebase/messaging');

                        const swUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
                        const fcmScope = `${import.meta.env.BASE_URL}firebase-cloud-messaging-push-scope`;

                        try {
                            let registration = await navigator.serviceWorker.getRegistration(fcmScope);
                            if (!registration) {
                                registration = await navigator.serviceWorker.register(swUrl, {
                                    scope: fcmScope
                                });
                            }

                            token = await getToken(messaging, {
                                vapidKey: 'BL36u1e0V4xvIyP8n_Nh1Uc_EZTquN1vNv58E3wm_q3IsQ916MfhsbF1NATwfeoitmAIyhMTC5TdhB7CSBRAz-4',
                                serviceWorkerRegistration: registration
                            });
                            if (token) {
                                localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
                            }
                        } catch (swError) {
                            console.error('FCM Service Worker registration failed:', swError);
                            alert(`❌ Service Worker hatası: ${swError.message}`);
                            return;
                        }
                    } else {
                        alert('⚠️ Bildirim izni reddedildi! Tarayıcı ayarlarından izin vermelisiniz.');
                        return;
                    }
                } catch (err) {
                    console.error('Token alınamadı:', err);
                    alert(`❌ Bildirim hatası: ${err.message}`);
                    return;
                }
            }

            if (token) {
                const oldPlayerId = (previousToken && previousToken !== token) ? previousToken : undefined;
                const response = await fetch(`${BACKEND_URL}/reminder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        playerId: token,
                        oldPlayerId,
                        options: optionsToSave
                    })
                });

                if (!response.ok) {
                    throw new Error(`Backend error: ${response.status}`);
                }

                const result = await response.json();
                console.log('Backend response:', result);
            } else if (!isDisablingAll) {
                alert('❌ Bildirim tokeni alınamadı. Lütfen tekrar deneyin.');
                return;
            } else {
                console.warn('No stored token found while disabling notifications; local state cleared only.');
            }

            if (count === 0) {
                setHasActiveNotifications(false);
                localStorage.removeItem('fb_has_notifications');
                localStorage.removeItem('fb_notification_options');
                alert('✅ Tüm bildirimler temizlendi!');
            } else {
                setHasActiveNotifications(true);
                localStorage.setItem('fb_has_notifications', 'true');
                localStorage.setItem('fb_notification_options', JSON.stringify(optionsToSave));
                alert(`✅ ${count} bildirim ayarlandı! Tüm maçlara uygulanacak.`);
            }

            setSelectedOptions(optionsToSave);
            setDraftOptions(null);
            setShowModal(false);

        } catch (error) {
            console.error('Bildirim kaydetme hatası:', error);
            alert('❌ Bağlantı hatası! Lütfen tekrar deneyin.');
        }
    };

    const notificationOptions = [
        {
            id: 'threeHours',
            label: 'Maçtan 3 saat önce',
            description: 'Hazırlık yapmaya zamanın olsun'
        },
        {
            id: 'oneHour',
            label: 'Maçtan 1 saat önce',
            description: 'Heyecan zamanı!'
        },
        {
            id: 'thirtyMinutes',
            label: 'Maçtan 30 dakika önce',
            description: 'Son hazırlık'
        },
        {
            id: 'fifteenMinutes',
            label: 'Maçtan 15 dakika önce',
            description: 'Maç başlıyor!'
        }
    ];

    const currentDraftOptions = draftOptions ?? selectedOptions;
    const hasDraftChanges = JSON.stringify(currentDraftOptions) !== JSON.stringify(selectedOptions);
    const draftSelectionCount = Object.entries(currentDraftOptions).filter(([k, v]) => v && k !== 'updatedAt').length;
    const savedSelectionCount = Object.entries(selectedOptions).filter(([k, v]) => v && k !== 'updatedAt').length;

    return (
        <>
            {/* Bildirim Ayarları İkonu - Logo ile aynı boyut (w-10 h-10) */}
            <button
                onClick={handleOpenModal}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 hover:scale-110 ${hasActiveNotifications ? 'ring-2 ring-yellow-400/60 text-yellow-400/80' : ''}`}
                title="Bildirim ayarları"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActiveNotifications ? 2 : 1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>

            {/* Bildirim Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
                    onClick={handleCloseModal}
                >
                    <div
                        className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slideUp shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Bildirim Ayarları
                                </h2>
                                <p className="text-sm text-slate-400 mt-2">
                                    Tüm maçlar için geçerli
                                </p>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Bilgilendirme */}
                        <div className="glass-panel rounded-xl p-4 mb-6 border border-yellow-400/20">
                            <div className="flex items-center gap-2 text-yellow-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm font-semibold">Bu ayarlar tüm maçlara uygulanır</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                Bir kez ayarla, her maç için otomatik bildirim al!
                            </p>
                        </div>

                        {/* Seçenekler */}
                        <div className="space-y-3 mb-6">
                            {notificationOptions.map((option) => (
                                <label
                                    key={option.id}
                                    className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${currentDraftOptions[option.id]
                                        ? 'bg-yellow-400/20 border-yellow-400 scale-[1.02]'
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={currentDraftOptions[option.id]}
                                        onChange={() => toggleOption(option.id)}
                                        className="mt-1 w-5 h-5 rounded border-2 border-yellow-400 bg-transparent checked:bg-yellow-400 cursor-pointer accent-yellow-400"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white">{option.label}</span>
                                        </div>
                                        <p className="text-xs text-slate-400">{option.description}</p>
                                    </div>
                                </label>
                            ))}

                            {/* Günlük Kontrol - ÖZEL */}
                            <div className="pt-3 border-t border-white/10">
                                <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${currentDraftOptions.dailyCheck
                                    ? 'bg-blue-400/20 border-blue-400 scale-[1.02]'
                                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={currentDraftOptions.dailyCheck}
                                        onChange={() => toggleOption('dailyCheck')}
                                        className="mt-1 w-5 h-5 rounded border-2 border-blue-400 bg-transparent checked:bg-blue-400 cursor-pointer accent-blue-400"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-white">Günlük Maç Kontrolü</span>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold">ÖZEL</span>
                                        </div>
                                        <p className="text-xs text-slate-400">
                                            Her sabah 09:00'da kontrol et, o gün maç varsa bildir
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Seçim Özeti */}
                        {Object.entries(currentDraftOptions).some(([k, v]) => v && k !== 'updatedAt') && (
                            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4 animate-fadeIn">
                                <p className="text-xs text-yellow-200">
                                    <strong className="text-yellow-400">{draftSelectionCount}</strong> bildirim seçtiniz
                                </p>
                            </div>
                        )}

                        {/* Butonlar */}
                        <div className="flex gap-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCloseModal();
                                }}
                                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 font-medium border border-white/10 hover:border-white/20"
                            >
                                İptal
                            </button>
                            <button
                                onClick={saveNotifications}
                                disabled={!hasDraftChanges}
                                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-200 ${!hasDraftChanges
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                                    : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-300 hover:to-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-105'
                                    }`}
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationSettings;
