import { useState, useEffect, useRef } from 'react';
import { database } from '../firebase';
import { ref, onValue, runTransaction, get, set } from "firebase/database";
import { BarChart3, CheckCircle } from 'lucide-react';
import { useAuth, getSignInErrorMessage } from '../contexts/AuthContext';

interface PollProps {
    opponentName?: string;
    matchId: number | string;
}

type VoteOption = 'home' | 'away' | 'draw';

interface Votes {
    home: number;
    away: number;
    draw: number;
}

const Poll = ({ opponentName = "Rakip Takım", matchId }: PollProps) => {
    const { user, loading: authLoading, signInWithGoogle } = useAuth();
    const [votes, setVotes] = useState<Votes>({ home: 0, away: 0, draw: 0 });
    const [hasVoted, setHasVoted] = useState(false);
    const [showSignIn, setShowSignIn] = useState(false);
    const [userVote, setUserVote] = useState<VoteOption | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [signInSuccess, setSignInSuccess] = useState(false);
    const voteBlockedUntil = useRef(0);

    const match = {
        home: "Fenerbahçe",
        away: opponentName
    };

    useEffect(() => {
        if (!matchId) {
            setLoading(false);
            return;
        }

        // Everyone can read votes (even anonymous)
        const votesRef = ref(database, `match_polls/${matchId}/votes`);
        const unsubscribeVotes = onValue(votesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setVotes({
                    home: data.home || 0,
                    away: data.away || 0,
                    draw: data.draw || 0
                });
            } else {
                setVotes({ home: 0, away: 0, draw: 0 });
            }
            setLoading(false);
        }, () => {
            setError("Anket verileri yüklenemedi.");
            setLoading(false);
        });

        // Only check user vote if signed in with Google
        if (user) {
            const userVoteRef = ref(database, `match_polls/${matchId}/users/${user.uid}`);
            get(userVoteRef).then((snapshot) => {
                if (snapshot.exists()) {
                    setHasVoted(true);
                    setUserVote(snapshot.val() as VoteOption);
                } else {
                    setHasVoted(false);
                    setUserVote(null);
                }
            }).catch((error) => {
                console.error("Error checking user vote:", error);
            });
        } else {
            setHasVoted(false);
            setUserVote(null);
        }

        return () => {
            unsubscribeVotes();
        };
    }, [matchId, user]);

    const handleVote = async (option: VoteOption) => {
        if (hasVoted || !matchId) return;

        // Block votes briefly after sign-in to prevent ghost clicks
        if (Date.now() < voteBlockedUntil.current) return;

        // Require Google sign-in to vote
        if (!user) {
            setAuthError(null);
            setShowSignIn(true);
            return;
        }

        try {
            const userVoteRef = ref(database, `match_polls/${matchId}/users/${user.uid}`);
            const userSnapshot = await get(userVoteRef);

            if (userSnapshot.exists()) {
                setHasVoted(true);
                setUserVote(userSnapshot.val() as VoteOption);
                return;
            }

            const votesRef = ref(database, `match_polls/${matchId}/votes/${option}`);
            await runTransaction(votesRef, (currentVote: number | null) => {
                return (currentVote || 0) + 1;
            });

            await set(userVoteRef, option);

            setHasVoted(true);
            setUserVote(option);
        } catch (error) {
            console.error("Vote failed:", error);
            alert("Oy verilemedi. Lütfen tekrar deneyin.");
        }
    };

    const totalVotes = (votes.home || 0) + (votes.away || 0) + (votes.draw || 0);

    const getPercentage = (count: number): number => {
        if (!totalVotes || totalVotes === 0) return 0;
        return Math.round(((count || 0) / totalVotes) * 100);
    };

    const [isExpanded, setIsExpanded] = useState(false);

    if (loading || authLoading) return null;
    if (error) return null;
    if (!matchId) return null;

    return (
        <>
        {showSignIn && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn" onClick={() => {
                setShowSignIn(false);
                setAuthError(null);
            }}>
                <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full animate-slideUp shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold text-white">Oy Kullan</h2>
                        <button onClick={() => {
                            setShowSignIn(false);
                            setAuthError(null);
                        }} className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <div className="text-center py-4">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-400/10 flex items-center justify-center">
                            <BarChart3 className="w-8 h-8 text-yellow-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Oy vermek için giriş yap</h3>
                        <p className="text-sm text-slate-400 mb-6">
                            Google hesabınla giriş yap ve maç tahminini paylaş.
                        </p>
                        {signInSuccess ? (
                            <div className="flex flex-col items-center gap-2 py-2">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                                <p className="text-green-400 font-semibold">Giriş başarılı!</p>
                                <p className="text-xs text-slate-400">Şimdi oyunu kullanabilirsin.</p>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={async () => {
                                        try {
                                            const outcome = await signInWithGoogle();
                                            if (outcome !== 'cancelled') {
                                                setAuthError(null);
                                                setSignInSuccess(true);
                                                // Block votes for 1s after modal closes to prevent ghost clicks
                                                voteBlockedUntil.current = Date.now() + 1000;
                                                setTimeout(() => {
                                                    setShowSignIn(false);
                                                    setSignInSuccess(false);
                                                }, 1200);
                                            }
                                        } catch (err) {
                                            setAuthError(getSignInErrorMessage(err));
                                            console.error('Google sign-in failed:', err);
                                        }
                                    }}
                                    className="inline-flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                    </svg>
                                    Google ile Giriş Yap
                                </button>
                                {authError && (
                                    <p className="mt-4 text-xs leading-5 text-amber-300">
                                        {authError}
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden transition-all duration-500">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-yellow-400/10 text-yellow-400">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-base font-bold text-white">Maçı Kim Kazanır?</h3>
                        <p className="text-xs text-slate-400">
                            {hasVoted ? 'Oyunuz kullanıldı' : !user ? 'Oy vermek için giriş yap' : 'Tahminini yap'}
                            <span className="text-slate-500 ml-2">· Toplam: {totalVotes} oy</span>
                        </p>
                    </div>
                </div>
                <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>

            <div className={`transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="p-4 pt-0 space-y-3 border-t border-white/5 mt-2">
                    <PollOption
                        label={match.home}
                        count={votes.home}
                        percentage={getPercentage(votes.home)}
                        onClick={() => handleVote('home')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.home >= votes.away && votes.home >= votes.draw}
                        isUserChoice={userVote === 'home'}
                    />
                    <PollOption
                        label="Beraberlik"
                        count={votes.draw}
                        percentage={getPercentage(votes.draw)}
                        onClick={() => handleVote('draw')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.draw >= votes.home && votes.draw >= votes.away}
                        isUserChoice={userVote === 'draw'}
                    />
                    <PollOption
                        label={match.away}
                        count={votes.away}
                        percentage={getPercentage(votes.away)}
                        onClick={() => handleVote('away')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.away >= votes.home && votes.away >= votes.draw}
                        isUserChoice={userVote === 'away'}
                    />
                </div>
            </div>

        </div>
        </>
    );
};

interface PollOptionProps {
    label: string;
    count: number;
    percentage: number;
    onClick: () => void;
    disabled: boolean;
    isWinner: boolean;
    isUserChoice: boolean;
}

const PollOption = ({ label, percentage, onClick, disabled, isWinner, isUserChoice }: PollOptionProps) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`relative w-full h-12 rounded-xl overflow-hidden transition-all duration-300 group ${disabled ? 'cursor-default' : 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
        >
            <div className="absolute inset-0 bg-white/5" />
            <div
                className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out ${isUserChoice ? 'bg-green-500/30' : isWinner ? 'bg-yellow-400/20' : 'bg-blue-600/30'
                    }`}
                style={{ width: `${percentage}%` }}
            />

            <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className={`font-medium transition-colors ${isUserChoice ? 'text-green-400' : isWinner ? 'text-yellow-400' : 'text-white'
                    }`}>
                    {label} {isUserChoice && '\u2713'}
                </span>

                <div className="flex items-center gap-2">
                    {disabled && (
                        <span className="text-sm font-bold text-white/90">
                            {percentage}%
                        </span>
                    )}
                    {!disabled && (
                        <div className="w-4 h-4 rounded-full border-2 border-white/20 group-hover:border-yellow-400 transition-colors" />
                    )}
                </div>
            </div>
        </button>
    );
};

export default Poll;
