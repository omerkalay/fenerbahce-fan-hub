import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/api';
import type { NotificationOptions } from '../types';
import { useAuth } from '../contexts/authContextDef';
import { getSignInErrorMessage } from '../utils/authHelpers';
import GoogleSignInModal, { GoogleSignInButton } from './GoogleSignInModal';
import {
    createEmptyOptions,
    normalizeOptions,
    countEnabledOptions,
    countMatchOptions,
    acquireFcmToken
} from '../utils/notificationHelpers';

const FCM_TOKEN_STORAGE_KEY = 'fb_fcm_token';

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
        } else {
          localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
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

        const currentToken = await acquireFcmToken();
        if (!currentToken) return;

        const storedToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
        if (currentToken === storedToken) return;

        const savedOptions = localStorage.getItem('fb_notification_options');
        if (!savedOptions || !user) return;

        const options = normalizeOptions(JSON.parse(savedOptions));
        const idToken = await user.getIdToken();
        const response = await fetch(`${BACKEND_URL}/reminder`, {
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

        if (!response.ok) {
          throw new Error(`Backend error: ${response.status}`);
        }

        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, currentToken);
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
  const draftMatchCount = countMatchOptions(currentDraftOptions);
  const draftGeneralCount = currentDraftOptions.generalNotifications ? 1 : 0;

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
            alert('Bu tarayıcı bildirimleri desteklemiyor.');
            return;
          }

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            alert('Bildirim izni reddedildi! Tarayıcı ayarlarından izin vermelisiniz.');
            return;
          }

          token = await acquireFcmToken();
          if (!token) {
            throw new Error('Firebase Messaging başlatılamadı');
          }
        } catch (err) {
          console.error('Token alınamadı:', err);
          alert(`Bildirim hatası: ${(err as Error).message}`);
          return;
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
          localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
        }
      } else if (!isDisablingAll) {
        alert('Bildirim tokeni alınamadı. Lütfen tekrar deneyin.');
        return;
      }

      const syncNote = topicSyncPending ? '\nGenel bildirim senkronu otomatik tekrar denenecek.' : '';
      if (count === 0) {
        setHasActiveNotifications(false);
        localStorage.removeItem('fb_has_notifications');
        localStorage.removeItem('fb_notification_options');
        alert('Tüm bildirimler temizlendi!' + syncNote);
      } else {
        setHasActiveNotifications(true);
        localStorage.setItem('fb_has_notifications', 'true');
        localStorage.setItem('fb_notification_options', JSON.stringify(optionsToSave));
        alert(`${count} bildirim ayarlandı!` + syncNote);
      }

      setSelectedOptions(optionsToSave);
      setDraftOptions(null);
      setShowModal(false);
    } catch (saveError) {
      console.error('Bildirim kaydetme hatası:', saveError);
      alert('Bağlantı hatası! Lütfen tekrar deneyin.');
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
                <p className="text-sm text-slate-400 mt-2">Genel ve maç bildirimlerini ayrı ayrı yönet</p>
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

            <div className="mb-5">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Genel Bildirimler</h3>
              <label
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all duration-200 border-2 ${currentDraftOptions.generalNotifications ? 'bg-emerald-400/20 border-emerald-400 scale-[1.02]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'}`}
              >
                <input
                  type="checkbox"
                  checked={currentDraftOptions.generalNotifications}
                  onChange={() => toggleOption('generalNotifications')}
                  className="mt-1 w-5 h-5 rounded border-2 border-emerald-400 bg-transparent checked:bg-emerald-400 cursor-pointer accent-emerald-400"
                />
                <div className="flex-1">
                  <span className="font-semibold text-white">Önemli Duyurular</span>
                  <p className="text-xs text-slate-400 mt-1">Kulüple ilgili önemli duyuru ve manuel toplu bildirimleri al</p>
                </div>
              </label>
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">Maç Bildirimleri</h3>

              <div className="glass-panel rounded-xl p-4 mb-4 border border-yellow-400/20">
                <div className="flex items-center gap-2 text-yellow-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold">Bu ayarlar tüm maçlara uygulanır</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Bir kez ayarla, her maç için otomatik bildirim al!</p>
              </div>

              <div className="space-y-3">
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
            </div>

            {(draftGeneralCount > 0 || draftMatchCount > 0) && (
              <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-3 mb-4 animate-fadeIn">
                <p className="text-xs text-yellow-200">
                  <strong className="text-yellow-400">
                    {draftGeneralCount > 0 && draftMatchCount > 0
                      ? `${draftGeneralCount} genel + ${draftMatchCount} maç`
                      : draftGeneralCount > 0
                        ? `${draftGeneralCount} genel`
                        : `${draftMatchCount} maç`}
                  </strong>{' '}bildirim seçtiniz
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
