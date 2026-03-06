import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/api';
import type { NotificationOptions } from '../types';
import { useAuth, getSignInErrorMessage } from '../contexts/AuthContext';
import GoogleSignInModal, { GoogleSignInButton } from './GoogleSignInModal';

const FCM_TOKEN_STORAGE_KEY = 'fb_fcm_token';

const createEmptyOptions = (): NotificationOptions => ({
  threeHours: false,
  oneHour: false,
  thirtyMinutes: false,
  fifteenMinutes: false,
  dailyCheck: false
});

const normalizeOptions = (options?: Partial<NotificationOptions>): NotificationOptions => ({
  ...createEmptyOptions(),
  ...options
});

const countEnabledOptions = (options: NotificationOptions): number => (
  Object.entries(options).filter(([key, value]) => key !== 'updatedAt' && value === true).length
);

const NotificationSettings = () => {
  const { user, signInWithGoogle } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<NotificationOptions>(() => {
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
  const [draftOptions, setDraftOptions] = useState<NotificationOptions | null>(null);
  const [hasActiveNotifications, setHasActiveNotifications] = useState(() => {
    const saved = localStorage.getItem('fb_has_notifications');
    return saved === 'true';
  });
  const [authError, setAuthError] = useState<string | null>(null);

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

  useEffect(() => {
    const clearLocalState = () => {
      setSelectedOptions(createEmptyOptions());
      setDraftOptions(null);
      setHasActiveNotifications(false);
      localStorage.removeItem('fb_has_notifications');
      localStorage.removeItem('fb_notification_options');
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
          }
        });

        if (response.status === 404) {
          clearLocalState();
          return;
        }

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`);
        }

        const result = await response.json();
        const serverOptions = normalizeOptions(result.options);
        const enabledCount = countEnabledOptions(serverOptions);

        setSelectedOptions(serverOptions);
        setDraftOptions(null);
        setHasActiveNotifications(enabledCount > 0);

        if (enabledCount > 0) {
          localStorage.setItem('fb_has_notifications', 'true');
          localStorage.setItem('fb_notification_options', JSON.stringify(serverOptions));
        } else {
          localStorage.removeItem('fb_has_notifications');
          localStorage.removeItem('fb_notification_options');
        }

        if (result.fcmToken) {
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, result.fcmToken);
        }
      } catch (err) {
        console.error('Notification preferences load error:', err);
      }
    };

    loadServerPreferences();
  }, [user]);

  useEffect(() => {
    if (!hasActiveNotifications) return;

    const syncToken = async () => {
      try {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (!('serviceWorker' in navigator)) return;

        const { messaging } = await import('../firebase');
        const { getToken } = await import('firebase/messaging');
        if (!messaging) return;

        const registration = await navigator.serviceWorker.ready;
        const currentToken = await getToken(messaging, {
          vapidKey: 'BL36u1e0V4xvIyP8n_Nh1Uc_EZTquN1vNv58E3wm_q3IsQ916MfhsbF1NATwfeoitmAIyhMTC5TdhB7CSBRAz-4',
          serviceWorkerRegistration: registration
        });

        if (!currentToken) return;

        const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        if (currentToken === storedToken) return;

        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);

        const savedOptions = localStorage.getItem('fb_notification_options');
        if (!savedOptions || !user) return;

        const options = normalizeOptions(JSON.parse(savedOptions));
        const idToken = await user.getIdToken();
        await fetch(`${BACKEND_URL}/reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fcmToken: currentToken,
            oldFcmToken: storedToken || undefined,
            options
          })
        });
      } catch (err) {
        console.error('FCM token sync error:', err);
      }
    };

    syncToken();
  }, [hasActiveNotifications, user]);

  const toggleOption = (optionId: keyof NotificationOptions) => {
    setDraftOptions((previous) => {
      const base = previous ?? selectedOptions;
      return {
        ...base,
        [optionId]: !base?.[optionId]
      };
    });
  };

  const handleOpenModal = () => {
    setAuthError(null);
    setDraftOptions({ ...selectedOptions });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setAuthError(null);
    setDraftOptions(null);
    setShowModal(false);
  };

  const currentDraftOptions = draftOptions ?? selectedOptions;
  const hasDraftChanges = JSON.stringify(currentDraftOptions) !== JSON.stringify(selectedOptions);
  const draftSelectionCount = countEnabledOptions(currentDraftOptions);

  const saveNotifications = async () => {
    if (isSaving) return;

    setIsSaving(true);
    const optionsToSave = normalizeOptions(currentDraftOptions);
    const count = Object.entries(optionsToSave).filter(([key, value]) => key !== 'updatedAt' && value).length;
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
          if (permission !== 'granted') {
            alert('⚠️ Bildirim izni reddedildi! Tarayıcı ayarlarından izin vermelisiniz.');
            return;
          }

          const { messaging } = await import('../firebase');
          const { getToken } = await import('firebase/messaging');
          if (!messaging) {
            throw new Error('Firebase Messaging başlatılamadı');
          }

          const registration = await navigator.serviceWorker.ready;
          token = await getToken(messaging, {
            vapidKey: 'BL36u1e0V4xvIyP8n_Nh1Uc_EZTquN1vNv58E3wm_q3IsQ916MfhsbF1NATwfeoitmAIyhMTC5TdhB7CSBRAz-4',
            serviceWorkerRegistration: registration
          });

          if (token) {
            localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
          }
        } catch (err) {
          console.error('Token alınamadı:', err);
          alert(`❌ Bildirim hatası: ${(err as Error).message}`);
          return;
        }
      }

      if (token && user) {
        const oldFcmToken = previousToken && previousToken !== token ? previousToken : undefined;
        const idToken = await user.getIdToken();
        const response = await fetch(`${BACKEND_URL}/reminder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify({
            fcmToken: token,
            oldFcmToken,
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
    } catch (saveError) {
      console.error('Bildirim kaydetme hatası:', saveError);
      alert('❌ Bağlantı hatası! Lütfen tekrar deneyin.');
    } finally {
      setIsSaving(false);
    }
  };

  const notificationOptions: Array<{ id: keyof NotificationOptions; label: string; description: string }> = [
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

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 hover:scale-110 ${hasActiveNotifications ? 'ring-2 ring-yellow-400/60 text-yellow-400/80' : ''}`}
        title="Bildirim ayarları"
        aria-label="Bildirim ayarları"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActiveNotifications ? 2 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      <GoogleSignInModal
        open={showModal && !user}
        title="Bildirim Ayarları"
        heading="Bildirim almak için giriş yap"
        description="Google hesabınla giriş yap, bildirim ayarların tüm cihazlarda senkronize kalsın."
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        authError={authError}
        onClose={handleCloseModal}
        footer={<p className="text-xs text-slate-500 mt-4">Giriş yaparak bildirim tercihlerini kaydedebilirsin.</p>}
      >
        <GoogleSignInButton
          onClick={async () => {
            try {
              const outcome = await signInWithGoogle();
              if (outcome !== 'cancelled') {
                setAuthError(null);
              }
            } catch (signInError) {
              setAuthError(getSignInErrorMessage(signInError));
              console.error('Google sign-in failed:', signInError);
            }
          }}
        />
      </GoogleSignInModal>

      {showModal && user && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
          onClick={handleCloseModal}
        >
          <div
            className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto animate-slideUp shadow-2xl"
            onClick={(event: React.MouseEvent) => event.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Bildirim Ayarları</h2>
                <p className="text-sm text-slate-400 mt-2">Tüm maçlar için geçerli</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                aria-label="Kapat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="glass-panel rounded-xl p-4 mb-6 border border-yellow-400/20">
              <div className="flex items-center gap-2 text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-semibold">Bu ayarlar tüm maçlara uygulanır</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Bir kez ayarla, her maç için otomatik bildirim al!</p>
            </div>

            <div className="space-y-3 mb-6">
              {notificationOptions.map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${currentDraftOptions[option.id] ? 'bg-yellow-400/20 border-yellow-400 scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(currentDraftOptions[option.id])}
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

              <div className="pt-3 border-t border-white/10">
                <label className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${currentDraftOptions.dailyCheck ? 'bg-blue-400/20 border-blue-400 scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}>
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
                    <p className="text-xs text-slate-400">Her sabah 09:00'da kontrol et, o gün maç varsa bildir</p>
                  </div>
                </label>
              </div>
            </div>

            {Object.entries(currentDraftOptions).some(([key, value]) => key !== 'updatedAt' && value) && (
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4 animate-fadeIn">
                <p className="text-xs text-yellow-200">
                  <strong className="text-yellow-400">{draftSelectionCount}</strong> bildirim seçtiniz
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 font-medium border border-white/10 hover:border-white/20"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={saveNotifications}
                disabled={!hasDraftChanges || isSaving}
                className={`flex-1 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all duration-200 ${!hasDraftChanges || isSaving ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-black hover:from-yellow-300 hover:to-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] hover:scale-105'}`}
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationSettings;
