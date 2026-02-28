import { useState, useEffect, useRef } from 'react';
import type { MatchData, LiveMatchState } from '../types';

interface MatchCountdownProps {
    matchData: MatchData;
    liveMatchState: LiveMatchState;
    onCountdownEnd: () => void;
}

const MatchCountdown: React.FC<MatchCountdownProps> = ({ matchData, liveMatchState, onCountdownEnd }) => {
    const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
    const countdownEndedRef = useRef<boolean>(false);

    // Reset countdownEndedRef when match changes
    useEffect(() => {
        countdownEndedRef.current = false;
    }, [matchData?.id]);

    useEffect(() => {
        if (!matchData || liveMatchState !== 'countdown') return;

        const updateCountdown = () => {
            const matchDate = new Date(matchData.startTimestamp * 1000);
            const now = new Date();
            const difference = matchDate.getTime() - now.getTime();

            if (difference > 0) {
                const days = Math.floor(difference / (1000 * 60 * 60 * 24));
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
                const minutes = Math.floor((difference / 1000 / 60) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                setTimeLeft({ days, hours, minutes, seconds });
            } else {
                // Countdown reached 0 — trigger live checking
                if (!countdownEndedRef.current && onCountdownEnd) {
                    countdownEndedRef.current = true;
                    onCountdownEnd();
                }
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);

        return () => clearInterval(timer);
    }, [matchData, liveMatchState, onCountdownEnd]);

    if (liveMatchState !== 'countdown') return null;

    return (
        <div className="grid grid-cols-4 gap-2 text-center">
            <div className="glass-panel rounded-lg p-2">
                <span className="block text-xl font-bold text-yellow-400">{timeLeft.days}</span>
                <span className="text-[10px] text-slate-400 uppercase">Gün</span>
            </div>
            <div className="glass-panel rounded-lg p-2">
                <span className="block text-xl font-bold text-yellow-400">{timeLeft.hours}</span>
                <span className="text-[10px] text-slate-400 uppercase">Saat</span>
            </div>
            <div className="glass-panel rounded-lg p-2">
                <span className="block text-xl font-bold text-yellow-400">{timeLeft.minutes}</span>
                <span className="text-[10px] text-slate-400 uppercase">Dk</span>
            </div>
            <div className="glass-panel rounded-lg p-2">
                <span className="block text-xl font-bold text-yellow-400">{timeLeft.seconds}</span>
                <span className="text-[10px] text-slate-400 uppercase">Sn</span>
            </div>
        </div>
    );
};

export default MatchCountdown;
