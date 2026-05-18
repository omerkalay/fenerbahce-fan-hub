import { useEffect, useMemo, useState } from 'react';
import CustomStandings from './CustomStandings';
import SeasonSelector from './SeasonSelector';
import { getCurrentSeasonStartYear, getRecentSeasonOptions } from '../utils/seasons';

interface StandingsModalProps {
    visible: boolean;
    league: string;
    initialSeasonStartYear?: number;
    onClose: () => void;
}

const StandingsModal: React.FC<StandingsModalProps> = ({ visible, league, initialSeasonStartYear, onClose }) => {
    const [selectedSeasonStartYear, setSelectedSeasonStartYear] = useState<number>(
        () => initialSeasonStartYear ?? getCurrentSeasonStartYear()
    );
    const seasonOptions = useMemo(() => getRecentSeasonOptions(), []);

    useEffect(() => {
        if (visible) {
            setSelectedSeasonStartYear(initialSeasonStartYear ?? getCurrentSeasonStartYear());
        }
    }, [initialSeasonStartYear, visible]);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden glass-card rounded-2xl border border-yellow-400/20 animate-slideUp flex flex-col"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-start justify-between gap-3 shrink-0">
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white">
                            {league === 'superlig' ? 'Süper Lig Puan Durumu' : 'UEFA Avrupa Ligi Puan Durumu'}
                        </p>
                        <SeasonSelector
                            value={selectedSeasonStartYear}
                            options={seasonOptions}
                            onChange={setSelectedSeasonStartYear}
                            minimal
                            className="mt-2"
                        />
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                        aria-label="Kapat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="w-full flex-1 min-h-0 overflow-y-auto">
                    <CustomStandings league={league} seasonStartYear={selectedSeasonStartYear} />
                </div>
            </div>
        </div>
    );
};

export default StandingsModal;
