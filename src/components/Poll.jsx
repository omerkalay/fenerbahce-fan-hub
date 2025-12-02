import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, runTransaction } from "firebase/database";
import { BarChart3, CheckCircle2 } from 'lucide-react';

const Poll = ({ opponentName = "Rakip Takım", matchId }) => {
    const [votes, setVotes] = useState({ home: 0, away: 0, draw: 0 });
    const [hasVoted, setHasVoted] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const match = {
        home: "Fenerbahçe",
        away: opponentName
    };

    useEffect(() => {
        // Check local storage for vote status
        const voted = localStorage.getItem('fenerbahce_poll_voted');
        const lastMatchId = localStorage.getItem('fenerbahce_last_match_id');

        // If match changed, reset votes and clear vote status
        if (matchId && lastMatchId && String(lastMatchId) !== String(matchId)) {
            localStorage.removeItem('fenerbahce_poll_voted');
            setHasVoted(false);

            // Reset votes in Firebase
            const votesRef = ref(database, 'match_poll');
            import('firebase/database').then(({ set }) => {
                set(votesRef, { home: 0, away: 0, draw: 0 });
            });
        } else if (voted) {
            setHasVoted(true);
        }

        // Save current matchId
        if (matchId) {
            localStorage.setItem('fenerbahce_last_match_id', String(matchId));
        }

        // Listen for vote updates
        const votesRef = ref(database, 'match_poll');
        const unsubscribe = onValue(votesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setVotes({
                    home: data.home || 0,
                    away: data.away || 0,
                    draw: data.draw || 0
                });
            } else {
                // Initialize if empty
                setVotes({ home: 0, away: 0, draw: 0 });
            }
            setLoading(false);
        }, (error) => {
            console.error("Firebase read error:", error);
            setError("Anket verileri yüklenemedi. Firebase ayarlarını kontrol edin.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [matchId]);

    const handleVote = (option) => {
        if (hasVoted) return;

        const votesRef = ref(database, 'match_poll/' + option);

        // Use transaction to atomically increment vote
        runTransaction(votesRef, (currentVote) => {
            return (currentVote || 0) + 1;
        }).then(() => {
            localStorage.setItem('fenerbahce_poll_voted', 'true');
            setHasVoted(true);
        }).catch((error) => {
            console.error("Vote failed:", error);
            alert("Oy verilemedi. Lütfen tekrar deneyin.");
        });
    };

    const totalVotes = (votes.home || 0) + (votes.away || 0) + (votes.draw || 0);

    const getPercentage = (count) => {
        if (!totalVotes || totalVotes === 0) return 0;
        return Math.round(((count || 0) / totalVotes) * 100);
    };

    const [isExpanded, setIsExpanded] = useState(false);

    if (loading) return null; // Don't show anything while loading
    if (error) return null; // Hide on error

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
                    {/* Home Win */}
                    <PollOption
                        label={match.home}
                        count={votes.home}
                        percentage={getPercentage(votes.home)}
                        onClick={() => handleVote('home')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.home >= votes.away && votes.home >= votes.draw}
                    />

                    {/* Draw */}
                    <PollOption
                        label="Beraberlik"
                        count={votes.draw}
                        percentage={getPercentage(votes.draw)}
                        onClick={() => handleVote('draw')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.draw >= votes.home && votes.draw >= votes.away}
                    />

                    {/* Away Win */}
                    <PollOption
                        label={match.away}
                        count={votes.away}
                        percentage={getPercentage(votes.away)}
                        onClick={() => handleVote('away')}
                        disabled={hasVoted}
                        isWinner={hasVoted && votes.away >= votes.home && votes.away >= votes.draw}
                    />
                </div>
            </div>
        </div>
    );
};

const PollOption = ({ label, count, percentage, onClick, disabled, isWinner }) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`relative w-full h-12 rounded-xl overflow-hidden transition-all duration-300 group ${disabled ? 'cursor-default' : 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                }`}
        >
            {/* Background Bar */}
            <div className="absolute inset-0 bg-white/5" />
            <div
                className={`absolute inset-y-0 left-0 transition-all duration-1000 ease-out ${isWinner ? 'bg-yellow-400/20' : 'bg-blue-600/30'
                    }`}
                style={{ width: `${percentage}%` }}
            />

            {/* Content */}
            <div className="absolute inset-0 flex items-center justify-between px-4">
                <span className={`font-medium transition-colors ${isWinner ? 'text-yellow-400' : 'text-white'
                    }`}>
                    {label}
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
