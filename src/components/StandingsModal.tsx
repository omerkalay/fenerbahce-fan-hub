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
                className="bg-[#0f172a] border-2 border-yellow-400/30 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-hidden animate-slideUp shadow-[0_0_40px_rgba(234,179,8,0.2)]"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-yellow-400/20">
                    <h2 className="text-xl font-bold text-yellow-400">
                        {league === 'superlig' ? 'Süper Lig Puan Durumu' : 'UEFA Avrupa Ligi Puan Durumu'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-yellow-400 hover:text-white hover:rotate-90 transition-all duration-300"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Custom Standings Component */}
                <div className="w-full">
                    <CustomStandings league={league} />
                </div>
            </div>
        </div>
    );
};

export default StandingsModal;
