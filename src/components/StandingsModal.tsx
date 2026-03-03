import CustomStandings from './CustomStandings';

interface StandingsModalProps {
    visible: boolean;
    league: string;
    onClose: () => void;
}

const StandingsModal: React.FC<StandingsModalProps> = ({ visible, league, onClose }) => {
    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden glass-card rounded-2xl border border-yellow-400/20 animate-slideUp"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-white">
                            {league === 'superlig' ? 'Süper Lig Puan Durumu' : 'UEFA Avrupa Ligi Puan Durumu'}
                        </p>
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

                <div className="w-full overflow-y-auto max-h-[calc(88vh-60px)]">
                    <CustomStandings league={league} />
                </div>
            </div>
        </div>
    );
};

export default StandingsModal;
