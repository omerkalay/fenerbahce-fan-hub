// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { User } from 'firebase/auth';

const mockSignInWithGoogle = vi.fn();
let mockUser: User | null = null;

vi.mock('../contexts/authContextDef', () => ({
    useAuth: () => ({
        user: mockUser,
        loading: false,
        signInWithGoogle: mockSignInWithGoogle,
    }),
}));

vi.mock('../firebase', () => ({
    database: {},
}));

let onValueCallback: ((snap: { val: () => unknown }) => void) | null = null;
const mockGet = vi.fn();

vi.mock('firebase/database', () => ({
    ref: vi.fn(),
    onValue: (_ref: unknown, cb: (snap: { val: () => unknown }) => void) => {
        onValueCallback = cb;
        return vi.fn();
    },
    get: (...args: unknown[]) => mockGet(...args),
}));

vi.mock('../utils/authHelpers', () => ({
    getSignInErrorMessage: (e: unknown) => String(e),
}));

const mockSubmitPollVote = vi.fn();
vi.mock('../services/api', () => ({
    submitPollVote: (...args: unknown[]) => mockSubmitPollVote(...args),
}));

vi.mock('./GoogleSignInModal', () => {
    const Modal = ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? <div data-testid="sign-in-modal">{children}</div> : null;
    const Button = ({ onClick }: { onClick: () => void }) =>
        <button data-testid="google-sign-in-btn" onClick={onClick}>Sign In</button>;
    Modal.displayName = 'GoogleSignInModal';
    return { default: Modal, GoogleSignInButton: Button };
});

import Poll from './Poll';

function makeUser(uid = 'u1'): User {
    return {
        uid,
        getIdToken: vi.fn().mockResolvedValue('id-tok'),
    } as unknown as User;
}

function renderPollAndExpand(matchId: number | string = 123) {
    const utils = render(<Poll opponentName="Galatasaray" matchId={matchId} />);

    act(() => {
        onValueCallback?.({ val: () => ({ home: 5, away: 3, draw: 2 }) });
    });

    const expandButton = screen.getByText('Maçı Kim Kazanır?');
    fireEvent.click(expandButton);

    return utils;
}

describe('Poll', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUser = null;
        onValueCallback = null;
        mockGet.mockResolvedValue({ exists: () => false, val: () => null });
    });

    it('opens sign-in modal when signed-out user tries to vote', () => {
        renderPollAndExpand();

        fireEvent.click(screen.getByText('Fenerbahçe'));

        expect(screen.getByTestId('sign-in-modal')).toBeDefined();
    });

    it('calls submitPollVote with correct arguments for signed-in user', async () => {
        mockUser = makeUser();
        mockSubmitPollVote.mockResolvedValue({
            success: true,
            alreadyVoted: false,
            userVote: 'home',
            votes: { home: 6, away: 3, draw: 2 },
            totalVotes: 11,
        });

        renderPollAndExpand();
        fireEvent.click(screen.getByText('Fenerbahçe'));

        await waitFor(() => {
            expect(mockSubmitPollVote).toHaveBeenCalledWith(123, 'home', 'id-tok');
        });
    });

    it('updates vote counts after successful response', async () => {
        mockUser = makeUser();
        mockSubmitPollVote.mockResolvedValue({
            success: true,
            alreadyVoted: false,
            userVote: 'draw',
            votes: { home: 5, away: 3, draw: 3 },
            totalVotes: 11,
        });

        renderPollAndExpand();
        fireEvent.click(screen.getByText('Beraberlik'));

        await waitFor(() => {
            expect(screen.getByText(/Toplam: 11 oy/)).toBeDefined();
        });
    });

    it('marks user choice with checkmark after voting', async () => {
        mockUser = makeUser();
        mockSubmitPollVote.mockResolvedValue({
            success: true,
            alreadyVoted: false,
            userVote: 'home',
            votes: { home: 6, away: 3, draw: 2 },
            totalVotes: 11,
        });

        renderPollAndExpand();
        fireEvent.click(screen.getByText('Fenerbahçe'));

        await waitFor(() => {
            const el = screen.getByText((content) =>
                content.includes('Fenerbahçe') && content.includes('\u2713')
            );
            expect(el).toBeDefined();
        });
    });

    it('disables vote buttons after user has voted', async () => {
        mockUser = makeUser();
        mockSubmitPollVote.mockResolvedValue({
            success: true,
            alreadyVoted: false,
            userVote: 'home',
            votes: { home: 6, away: 3, draw: 2 },
            totalVotes: 11,
        });

        renderPollAndExpand();
        fireEvent.click(screen.getByText('Fenerbahçe'));

        await waitFor(() => {
            const disabledButtons = screen.getAllByRole('button').filter(
                (btn) => btn.hasAttribute('disabled')
            );
            expect(disabledButtons.length).toBeGreaterThanOrEqual(3);
        });
    });

    it('shows existing vote when user already voted (from database)', async () => {
        mockUser = makeUser();
        mockGet.mockResolvedValue({ exists: () => true, val: () => 'away' });

        renderPollAndExpand();

        await waitFor(() => {
            expect(screen.getByText(/Oyunuz kullanıldı/)).toBeDefined();
        });
    });
});
