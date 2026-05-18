type StandingsLeague = 'superlig' | 'europa';

interface DashboardStandingsPanelProps {
    onOpen: (league: StandingsLeague) => void;
    className?: string;
}

const DashboardStandingsPanel: React.FC<DashboardStandingsPanelProps> = ({
    onOpen,
    className = ''
}) => {
    return (
        <div className={`glass-panel rounded-2xl p-4 mb-6 ${className}`}>
            <h3 className="text-sm font-bold text-white mb-3">Puan Durumu</h3>
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => onOpen('superlig')}
                    className="px-4 py-3 bg-yellow-400/5 hover:bg-yellow-400/90 text-yellow-400/80 hover:text-black border border-yellow-400/20 hover:border-yellow-400/80 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                    Süper Lig
                </button>
                <button
                    onClick={() => onOpen('europa')}
                    className="px-4 py-3 bg-yellow-400/5 hover:bg-yellow-400/90 text-yellow-400/80 hover:text-black border border-yellow-400/20 hover:border-yellow-400/80 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                    Avrupa Ligi
                </button>
            </div>
        </div>
    );
};

export default DashboardStandingsPanel;
