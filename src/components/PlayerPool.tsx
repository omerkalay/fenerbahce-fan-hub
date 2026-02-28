import type { Player } from '../types';

interface PlayerPoolProps {
    squad: Player[];
    loading: boolean;
    isTouchDevice: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, player: Player) => void;
}

const PlayerPool = ({ squad, loading, isTouchDevice, onDragStart }: PlayerPoolProps) => {
    return (
        <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="text-sm font-bold text-slate-400 mb-2 px-2 uppercase tracking-wider">Oyuncular</h3>
            <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-20 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch]">
                <div className="grid grid-cols-4 gap-2">
                    {loading ? (
                        <div className="col-span-4 text-center text-slate-500 py-4">Yükleniyor...</div>
                    ) : (
                        squad.map(player => (
                            <div
                                key={player.id}
                                draggable={!isTouchDevice}
                                onDragStart={(e) => onDragStart(e, player)}
                                className="rounded-lg p-2 flex flex-col items-center gap-1 cursor-move active:scale-95 transition-transform bg-slate-900/75 border border-white/10 shadow-lg hover:bg-slate-800/80"
                            >
                                <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10 pointer-events-none">
                                    {player.photo ? (
                                        <img src={player.photo} alt={player.name} className="w-full h-full object-cover" crossOrigin="anonymous" draggable="false" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                            {player.number}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] text-center leading-tight line-clamp-2 h-6 flex items-center pointer-events-none">
                                    {player.name.split(' ').slice(-1)[0]}
                                </span>
                                <span className="text-[8px] text-slate-500 bg-slate-900/50 px-1.5 rounded pointer-events-none">
                                    {player.position}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlayerPool;
