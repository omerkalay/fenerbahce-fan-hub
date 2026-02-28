import { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, runTransaction, get, set } from "firebase/database";
import { BarChart3 } from 'lucide-react';

const getUserId = (): string => {
    let userId = localStorage.getItem('fenerbahce_user_id');
    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('fenerbahce_user_id', userId);
    }
    return userId;
};

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
    const [votes, setVotes] = useState<Votes>({ home: 0, away: 0, draw: 0 });
    const [hasVoted, setHasVoted] = useState(false);
    const [userVote, setUserVote] = useState<VoteOption | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const match = {
        home: "Fenerbahçe",
        away: opponentName
    };

    const userId = getUserId();

    useEffect(() => {
        if (!matchId) {
            setLoading(false);
            setError("Match ID eksik");
            return;
        }

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

        const userVoteRef = ref(database, `match_polls/${matchId}/users/${userId}`);
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

        return () => {
            unsubscribeVotes();
        };
    }, [matchId, userId]);

    const handleVote = async (option: VoteOption) => {
        if (hasVoted || !matchId) return;

        try {
            const userVoteRef = ref(database, `match_polls/${matchId}/users/${userId}`);
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

    if (loading) return null;
    if (error) return null;
    if (!matchId) return null;

    return (
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
                            {hasVoted ? 'Oyunuzu kullandınız' : 'Tahminini yap'} • {totalVotes} oy
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
                    {label} {isUserChoice && '✓'}
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
