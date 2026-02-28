import LiveMatchScore from './LiveMatchScore';

interface LiveMatchModalProps {
    visible: boolean;
    onClose: () => void;
}

const LiveMatchModal: React.FC<LiveMatchModalProps> = ({ visible, onClose }) => {
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
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                        <h2 className="text-xl font-bold text-yellow-400">Canlı Maç Detayları</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-yellow-400 hover:text-white transition-all duration-300 hover:rotate-90"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Live Match Component */}
                <div className="w-full">
                    <LiveMatchScore />
                </div>
            </div>
        </div>
    );
};

export default LiveMatchModal;
