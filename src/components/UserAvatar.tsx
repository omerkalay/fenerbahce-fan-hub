import { useState } from 'react';
import { getSignInErrorMessage, useAuth } from '../contexts/AuthContext';
import GoogleSignInModal, { GoogleSignInButton } from './GoogleSignInModal';

const UserAvatar = () => {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const closeModal = () => {
    setShowModal(false);
    setAuthError(null);
  };

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setAuthError(null);
            setShowModal(true);
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 text-slate-400 hover:bg-white/10 hover:text-yellow-400 transition-all duration-300"
          title="Giriş yap"
          aria-label="Hesap"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        <GoogleSignInModal
          open={showModal}
          title="Hesap"
          heading="Giriş Yap"
          description="Oy kullan, bildirim al ve ayarlarını tüm cihazlarda senkronize tut."
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
          authError={authError}
          onClose={closeModal}
        >
          <GoogleSignInButton
            onClick={async () => {
              try {
                const outcome = await signInWithGoogle();
                if (outcome !== 'cancelled') {
                  setAuthError(null);
                  setShowModal(false);
                }
              } catch (err) {
                setAuthError(getSignInErrorMessage(err));
                console.error('Google sign-in failed:', err);
              }
            }}
          />
        </GoogleSignInModal>
      </>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 bg-white/5 text-yellow-400/80 ring-2 ring-yellow-400/60 hover:bg-white/10 hover:ring-yellow-400 hover:scale-110"
        title={user.displayName || 'Hesap'}
        aria-label="Hesap menüsü"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-12 bg-[#0f172a] border border-white/10 rounded-xl p-3 z-50 min-w-[180px] shadow-2xl">
            <p className="text-sm text-white font-medium truncate">{user.displayName}</p>
            <p className="text-xs text-slate-400 truncate mb-2">{user.email}</p>
            <button
              type="button"
              onClick={async () => {
                setShowMenu(false);
                await signOut();
              }}
              className="w-full text-left text-sm text-red-400 hover:text-red-300 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default UserAvatar;
