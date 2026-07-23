import { useEffect, useRef, useState } from 'react';
import type { NotificationOptions } from '../types';
import { useAuth } from '../contexts/authContextDef';
import { useTheme } from '../contexts/themeContextDef';
import type { ThemeId } from '../theme/theme';
import { getSignInErrorMessage } from '../utils/authHelpers';
import useNotificationPreferences from '../hooks/useNotificationPreferences';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import GoogleSignInModal, { GoogleSignInButton } from './GoogleSignInModal';

const NotificationSettings = () => {
  const { user, signInWithGoogle } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationAuth, setShowNotificationAuth] = useState(false);
  const [openNotificationsAfterAuth, setOpenNotificationsAfterAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);

  const {
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
  } = useNotificationPreferences(user);

  useBodyScrollLock(showSettings || showNotifications || showNotificationAuth);

  const handleOpenSettings = () => {
    setAuthError(null);
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  const handleOpenNotifications = () => {
    setShowSettings(false);
    setAuthError(null);

    if (!user) {
      setShowNotificationAuth(true);
      return;
    }

    openDraft();
    setShowNotifications(true);
  };

  const handleCloseNotifications = () => {
    closeDraft();
    setShowNotifications(false);
  };

  const handleCloseNotificationAuth = () => {
    setShowNotificationAuth(false);
    setOpenNotificationsAfterAuth(false);
    setAuthError(null);
  };

  const handleSettingsDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !settingsDialogRef.current) return;

    const focusableElements = Array.from(
      settingsDialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleSave = async () => {
    const saved = await saveNotifications();
    if (saved) setShowNotifications(false);
  };

  useEffect(() => {
    if (showSettings) settingsCloseButtonRef.current?.focus();
  }, [showSettings]);

  useEffect(() => {
    if (!user || !openNotificationsAfterAuth) return;
    setShowNotificationAuth(false);
    setOpenNotificationsAfterAuth(false);
    openDraft();
    setShowNotifications(true);
  }, [openDraft, openNotificationsAfterAuth, user]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (showNotifications) {
        handleCloseNotifications();
      } else if (showNotificationAuth) {
        handleCloseNotificationAuth();
      } else if (showSettings) {
        handleCloseSettings();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const themeOptions: Array<{
    id: ThemeId;
    label: string;
    description: string;
  }> = [
    {
      id: 'classic',
      label: 'Klasik Gece',
      description: 'Mevcut koyu, cam yüzeyli tasarım',
    },
    {
      id: 'white-kit',
      label: 'Beyaz Forma',
      description: 'Krem, altın ve lacivert baskı stili',
    },
  ];

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
        onClick={handleOpenSettings}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 hover:scale-110 ${hasActiveNotifications ? 'ring-2 ring-yellow-400/60 text-yellow-400/80' : ''}`}
        title="Ayarlar"
        aria-label="Ayarlar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={hasActiveNotifications ? 2 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {showSettings && (
        <div
          className="settings-backdrop fixed inset-0 flex items-center justify-center z-[100] p-4 animate-fadeIn"
          onMouseDown={handleCloseSettings}
        >
          <div
            ref={settingsDialogRef}
            className="settings-dialog w-full max-w-md max-h-[88vh] overflow-y-auto animate-slideUp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onKeyDown={handleSettingsDialogKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="settings-header">
              <div>
                <p className="settings-kicker">Fenerbahçe Hub</p>
                <h2 id="settings-title">Ayarlar</h2>
              </div>
              <button
                ref={settingsCloseButtonRef}
                type="button"
                onClick={handleCloseSettings}
                className="settings-close"
                aria-label="Ayarları kapat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <fieldset className="settings-section">
              <legend>Tasarım</legend>
              <p className="settings-description">
                Görünüm bu cihazda saklanır ve uygulamayı tekrar açtığında korunur.
              </p>
              <div className="theme-options" role="radiogroup" aria-label="Tasarım teması">
                {themeOptions.map((option) => {
                  const selected = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`theme-option ${selected ? 'is-selected' : ''}`}
                      onClick={() => setTheme(option.id)}
                    >
                      <span className={`theme-preview theme-preview-${option.id}`} aria-hidden="true">
                        <span className="theme-preview-nav" />
                        <span className="theme-preview-card">
                          <span />
                          <span />
                        </span>
                      </span>
                      <span className="theme-option-copy">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      <span className="theme-option-check" aria-hidden="true">
                        {selected ? '✓' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="settings-section settings-notification-section">
              <div>
                <span className="settings-section-label">Bildirimler</span>
                <p className="settings-description">
                  {hasActiveNotifications
                    ? 'Bildirim tercihlerin etkin.'
                    : 'Maç ve önemli duyuru bildirimlerini yönet.'}
                </p>
              </div>
              <button
                type="button"
                className="settings-notification-button"
                onClick={handleOpenNotifications}
              >
                <span>{user ? 'Bildirim ayarlarını aç' : 'Giriş yap ve ayarla'}</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <GoogleSignInModal
        open={showNotificationAuth}
        title="Bildirim Ayarları"
        heading="Bildirim almak için giriş yap"
        description="Google hesabınla giriş yap, bildirim ayarların tüm cihazlarda senkronize kalsın."
        icon={
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        }
        authError={authError}
        onClose={handleCloseNotificationAuth}
        footer={<p className="text-xs text-slate-500 mt-4">Giriş yaparak bildirim tercihlerini kaydedebilirsin.</p>}
      >
        <GoogleSignInButton
          onClick={async () => {
            try {
              const outcome = await signInWithGoogle();
              if (outcome !== 'cancelled') {
                setAuthError(null);
                setOpenNotificationsAfterAuth(true);
              }
            } catch (signInError) {
              setAuthError(getSignInErrorMessage(signInError));
              console.error('Google sign-in failed:', signInError);
            }
          }}
        />
      </GoogleSignInModal>

      {showNotifications && user && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
          onClick={handleCloseNotifications}
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
                onClick={handleCloseNotifications}
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
                onClick={handleCloseNotifications}
                className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all duration-200 font-medium border border-white/10 hover:border-white/20"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
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
