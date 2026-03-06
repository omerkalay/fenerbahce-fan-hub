import type { ReactNode } from 'react';

interface GoogleSignInButtonProps {
  onClick: () => void | Promise<void>;
}

interface GoogleSignInModalProps {
  open: boolean;
  title: string;
  heading: string;
  description: string;
  icon: ReactNode;
  authError?: string | null;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export const GoogleSignInButton = ({ onClick }: GoogleSignInButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg"
  >
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    Google ile Giriş Yap
  </button>
);

const GoogleSignInModal = ({
  open,
  title,
  heading,
  description,
  icon,
  authError,
  onClose,
  children,
  footer
}: GoogleSignInModalProps) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full animate-slideUp shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
            aria-label="Kapat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-400/10 flex items-center justify-center">
            {icon}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{heading}</h3>
          <p className="text-sm text-slate-400 mb-6">{description}</p>
          {children}
          {authError && (
            <p className="mt-4 text-xs leading-5 text-amber-300">
              {authError}
            </p>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
};

export default GoogleSignInModal;
