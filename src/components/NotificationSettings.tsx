import ModalViewport from './ModalViewport';
import { useEffect, useRef, useState } from 'react';
import type { NotificationOptions } from '../types';
import { useAuth } from '../contexts/authContextDef';
import { useTheme } from '../contexts/themeContextDef';
import useMotionBackdrop from '../hooks/useMotionBackdrop';
import type { ThemeId } from '../theme/theme';
import { getSignInErrorMessage } from '../utils/authHelpers';
import useNotificationPreferences from '../hooks/useNotificationPreferences';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import GoogleSignInModal, { GoogleSignInButton } from './GoogleSignInModal';

interface NotificationSettingsProps {
  themeOnly?: boolean;
}

const NotificationSettings = ({ themeOnly = false }: NotificationSettingsProps) => {
  const { user, signInWithGoogle } = useAuth();
  const { theme, setTheme } = useTheme();
  const [motionBackdrop, setMotionBackdrop] = useMotionBackdrop();
  const [showSettings, setShowSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationAuth, setShowNotificationAuth] = useState(false);
  const [openNotificationsAfterAuth, setOpenNotificationsAfterAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const notificationsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const notificationsDialogRef = useRef<HTMLDivElement>(null);

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
  } = useNotificationPreferences(user, !themeOnly);

  useBodyScrollLock(showSettings || (!themeOnly && (showNotifications || showNotificationAuth)));

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

  const handleDialogKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    dialogRef: React.RefObject<HTMLDivElement | null>,
  ) => {
    if (event.key !== 'Tab' || !dialogRef.current) return;

    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
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
    if (showNotifications) notificationsCloseButtonRef.current?.focus();
  }, [showNotifications]);

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

  const matchReminderOptions: Array<{ id: keyof NotificationOptions; label: string }> = [
    { id: 'threeHours', label: 'Maçtan 3 saat önce' },
    { id: 'oneHour', label: 'Maçtan 1 saat önce' },
    { id: 'thirtyMinutes', label: 'Maçtan 30 dakika önce' },
    { id: 'fifteenMinutes', label: 'Maçtan 15 dakika önce' }
  ];

  const selectionSummary = draftGeneralCount === 0 && draftMatchCount === 0
    ? 'Şu an hiçbir bildirim seçili değil.'
    : `${[
        draftGeneralCount > 0 ? `${draftGeneralCount} genel` : null,
        draftMatchCount > 0 ? `${draftMatchCount} maç` : null
      ].filter(Boolean).join(' ve ')} bildirimi açık.`;

  const renderNotificationOption = (
    id: keyof NotificationOptions,
    label: string,
    description?: string,
  ) => {
    const selected = Boolean(currentDraftOptions[id]);

    return (
      <label key={id} className={`notify-option ${selected ? 'is-selected' : ''}`}>
        <input
          type="checkbox"
          className="notify-input"
          checked={selected}
          onChange={() => toggleOption(id)}
        />
        <span className="notify-check" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 10.5l4 4 8-8" />
          </svg>
        </span>
        <span className="notify-copy">
          <strong>{label}</strong>
          {description && <small>{description}</small>}
        </span>
      </label>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenSettings}
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 hover:scale-110 ${!themeOnly && hasActiveNotifications ? 'ring-2 ring-yellow-400/60 text-yellow-400/80' : ''}`}
        title="Ayarlar"
        aria-label="Ayarlar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={!themeOnly && hasActiveNotifications ? 2 : 1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {showSettings && (
        <ModalViewport
          className="settings-backdrop fixed inset-0 flex items-center justify-center z-[100] p-4 animate-fadeIn"
          onMouseDown={handleCloseSettings}
        >
          <div
            ref={settingsDialogRef}
            className="settings-dialog w-full max-w-md max-h-[88vh] overflow-y-auto animate-slideUp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            onKeyDown={(event) => handleDialogKeyDown(event, settingsDialogRef)}
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

              <div className="settings-motion-row">
                <div>
                  <span className="settings-section-label">Hareketli arka plan</span>
                  <p className="settings-description">
                    Kapatırsan arka plan sabit kalır. Cihazında azaltılmış hareket açıksa zaten sabit gelir.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={motionBackdrop}
                  aria-label="Hareketli arka plan"
                  onClick={() => setMotionBackdrop(!motionBackdrop)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    motionBackdrop ? 'bg-yellow-400' : 'bg-white/15'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                      motionBackdrop ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </fieldset>

            {!themeOnly && (
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
            )}
          </div>
        </ModalViewport>
      )}

      {!themeOnly && <GoogleSignInModal
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
      </GoogleSignInModal>}

      {!themeOnly && showNotifications && user && (
        <ModalViewport
          className="settings-backdrop fixed inset-0 flex items-center justify-center z-[100] p-4 animate-fadeIn"
          onMouseDown={handleCloseNotifications}
        >
          <div
            ref={notificationsDialogRef}
            className="settings-dialog notify-dialog w-full max-w-md animate-slideUp"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-settings-title"
            onKeyDown={(event) => handleDialogKeyDown(event, notificationsDialogRef)}
            onMouseDown={(event: React.MouseEvent) => event.stopPropagation()}
          >
            <div className="settings-header">
              <h2 id="notification-settings-title">Bildirim Ayarları</h2>
              <button
                ref={notificationsCloseButtonRef}
                type="button"
                onClick={handleCloseNotifications}
                className="settings-close"
                aria-label="Bildirim ayarlarını kapat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="notify-body">
              <fieldset className="settings-section notify-group notify-group-general">
                <legend>Duyurular</legend>
                <div className="notify-list">
                  {renderNotificationOption(
                    'generalNotifications',
                    'Önemli duyurular',
                    'Kulüp haberleri ve toplu bildirimler',
                  )}
                </div>
              </fieldset>

              <fieldset className="settings-section notify-group">
                <legend>Maç hatırlatmaları</legend>
                <p className="settings-description">
                  Seçtiğin hatırlatmalar bütün maçlar için geçerli olur.
                </p>
                <div className="notify-list">
                  {matchReminderOptions.map((option) => renderNotificationOption(option.id, option.label))}
                </div>
              </fieldset>

              <fieldset className="settings-section notify-group notify-group-daily">
                <legend>Günlük kontrol</legend>
                <div className="notify-list">
                  {renderNotificationOption(
                    'dailyCheck',
                    'Sabah 09:00 maç kontrolü',
                    'O gün maç varsa haber verir',
                  )}
                </div>
              </fieldset>
            </div>

            <div className="notify-footer">
              <p className="notify-summary">{selectionSummary}</p>
              <div className="notify-actions">
                <button
                  type="button"
                  onClick={handleCloseNotifications}
                  className="notify-button"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasDraftChanges || isSaving}
                  className="notify-button notify-button-primary"
                >
                  {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </ModalViewport>
      )}

    </>
  );
};

export default NotificationSettings;
