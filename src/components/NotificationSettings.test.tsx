// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetTheme = vi.fn();
const mockOpenDraft = vi.fn();
const mockCloseDraft = vi.fn();
const mockSignInWithGoogle = vi.fn();
let mockUser: User | null = null;
let mockTheme: 'classic' | 'white-kit' = 'classic';

vi.mock('../contexts/authContextDef', () => ({
  useAuth: () => ({
    user: mockUser,
    signInWithGoogle: mockSignInWithGoogle,
  }),
}));

vi.mock('../contexts/themeContextDef', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

vi.mock('../hooks/useBodyScrollLock', () => ({
  default: vi.fn(),
}));

vi.mock('../hooks/useNotificationPreferences', () => ({
  default: () => ({
    currentDraftOptions: {
      generalNotifications: false,
      threeHours: false,
      oneHour: false,
      thirtyMinutes: false,
      fifteenMinutes: false,
      dailyCheck: false,
    },
    hasDraftChanges: false,
    draftMatchCount: 0,
    draftGeneralCount: 0,
    hasActiveNotifications: false,
    isSaving: false,
    toggleOption: vi.fn(),
    openDraft: mockOpenDraft,
    closeDraft: mockCloseDraft,
    saveNotifications: vi.fn(),
  }),
}));

vi.mock('./GoogleSignInModal', () => {
  const Modal = ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => open ? <div data-testid="sign-in-modal">{children}</div> : null;
  const Button = ({ onClick }: { onClick: () => void }) => (
    <button type="button" onClick={onClick}>Google ile giriş yap</button>
  );
  Modal.displayName = 'GoogleSignInModal';
  return { default: Modal, GoogleSignInButton: Button };
});

import NotificationSettings from './NotificationSettings';

describe('NotificationSettings general settings flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = null;
    mockTheme = 'classic';
  });

  it('lets a signed-out user open settings and choose the white-kit theme', () => {
    render(<NotificationSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    expect(screen.getByRole('dialog', { name: 'Ayarlar' })).toBeDefined();

    fireEvent.click(screen.getByRole('radio', {
      name: 'Beyaz Forma Krem, altın ve lacivert baskı stili',
    }));

    expect(mockSetTheme).toHaveBeenCalledWith('white-kit');
  });

  it('asks for sign-in only when a signed-out user opens notifications', () => {
    render(<NotificationSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    expect(screen.queryByTestId('sign-in-modal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap ve ayarla' }));
    expect(screen.getByTestId('sign-in-modal')).toBeDefined();
  });

  it('opens notification preferences directly for a signed-in user', () => {
    mockUser = { uid: 'user-1' } as User;
    render(<NotificationSettings />);

    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bildirim ayarlarını aç' }));

    expect(mockOpenDraft).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Bildirim Ayarları' })).toBeDefined();
    expect(screen.queryByTestId('sign-in-modal')).toBeNull();
  });
});
