import { useState } from 'react';
import type { Player, PitchPlayers } from '../types';

interface PlayerSelectionModalProps {
    visible: boolean;
    squad: Player[];
    activePitchPlayers: PitchPlayers;
    onSelect: (player: Player) => void;
    onClose: () => void;
}

const PlayerSelectionModal = ({ visible, squad, activePitchPlayers, onSelect, onClose }: PlayerSelectionModalProps) => {
    const [playerSearch, setPlayerSearch] = useState<string>('');

    if (!visible) return null;

    const handleClose = () => {
        setPlayerSearch('');
        onClose();
    };

    const handleSelect = (player: Player) => {
        setPlayerSearch('');
        onSelect(player);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={handleClose}>
            <div className="glass-card rounded-2xl p-6 w-full max-w-sm max-h-[75vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 gap-3">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">Oyuncu Seç</h3>
                        <div className="mt-3 relative">
                            <input
                                type="text"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="İsim ya da forma no ile ara..."
                                className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400"
                            />
                            {playerSearch && (
                                <button
                                    onClick={() => setPlayerSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                                >
                                    Temizle
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain [-webkit-overflow-scrolling:touch]">
                    <div className="grid grid-cols-3 gap-2">
                        {(() => {
                            const normalizedSearch = playerSearch.trim().toLowerCase();
                            const filteredPlayers = normalizedSearch
                                ? squad.filter(player => {
                                    const nameMatch = player.name?.toLowerCase().includes(normalizedSearch);
                                    const numberMatch = String(player.number ?? '').includes(normalizedSearch);
                                    return nameMatch || numberMatch;
                                })
                                : squad;

                            if (!filteredPlayers.length) {
                                return (
                                    <div className="col-span-3 text-center text-slate-500 text-xs py-6">
                                        Oyuncu bulunamadı
                                    </div>
                                );
                            }

                            return filteredPlayers.map(player => {
                                const isAlreadyOnPitch = Object.values(activePitchPlayers).some(p => p.id === player.id);
                                return (
                                    <button
                                        key={player.id}
                                        onClick={() => handleSelect(player)}
                                        disabled={isAlreadyOnPitch}
                                        className={`rounded-lg p-2 flex flex-col items-center gap-1 transition-all bg-slate-900/75 border border-white/10 shadow-lg ${isAlreadyOnPitch
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-yellow-400/15 hover:border-yellow-400/35 cursor-pointer'
                                            }`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                                            {player.photo ? (
                                                <img src={player.photo} alt={player.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                                    {player.number}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-center leading-tight line-clamp-2 h-6 flex items-center">
                                            {player.name.split(' ').slice(-1)[0]}
                                        </span>
                                        <span className="text-[8px] text-slate-500 bg-slate-900/50 px-1.5 rounded">
                                            {player.position}
                                        </span>
                                    </button>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlayerSelectionModal;
