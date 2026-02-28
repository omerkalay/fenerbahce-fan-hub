import { useState, useEffect } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { fetchSquad, fetchInjuries } from '../services/api';
import type { Player, PlayerStatus, PositionCoord } from '../types';

const POSITIONS: Record<string, PositionCoord> = {
    GK: { top: '85%', left: '50%' },
    LB: { top: '65%', left: '15%' },
    CB1: { top: '70%', left: '35%' },
    CB2: { top: '70%', left: '65%' },
    RB: { top: '65%', left: '85%' },
    LM: { top: '40%', left: '15%' },
    CM1: { top: '45%', left: '35%' },
    CM2: { top: '45%', left: '65%' },
    RM: { top: '40%', left: '85%' },
    ST1: { top: '15%', left: '35%' },
    ST2: { top: '15%', left: '65%' },
};

const SquadBuilder = () => {
    const [squad, setSquad] = useState<Record<string, Player>>({});
    const [players, setPlayers] = useState<Player[]>([]);
    const [selectedPos, setSelectedPos] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const [squadData] = await Promise.all([fetchSquad(), fetchInjuries()]);
            setPlayers(squadData);
            setLoading(false);
        };
        loadData();
    }, []);

    const getPlayerStatus = (_player: Player): PlayerStatus | null => {
        return null;
    };

    const handlePositionClick = (pos: string) => {
        setSelectedPos(pos);
        setIsModalOpen(true);
    };

    const handlePlayerSelect = (player: Player) => {
        if (!selectedPos) return;
        const status = getPlayerStatus(player);
        setSquad(prev => ({ ...prev, [selectedPos]: { ...player, status } }));
        setIsModalOpen(false);
    };

    const removePlayer = (e: React.MouseEvent, pos: string) => {
        e.stopPropagation();
        setSquad(prev => {
            const newSquad = { ...prev };
            delete newSquad[pos];
            return newSquad;
        });
    };

    if (loading) {
        return <div className="p-10 text-center text-blue-300">Kadro yükleniyor...</div>;
    }

    return (
        <div className="h-full flex flex-col pb-20">
            <div className="p-4 text-center">
                <h1 className="text-2xl font-bold text-yellow-400 uppercase tracking-wider">Efsane 11</h1>
                <p className="text-blue-200 text-xs">Kadronu Kur, Paylaş</p>
            </div>

            <div className="flex-1 relative mx-4 my-2 bg-green-800 rounded-xl border-4 border-white/20 shadow-2xl overflow-hidden perspective-1000">
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute top-0 left-0 right-0 h-1/2 border-b-2 border-white/50"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-2 border-white/50 rounded-full"></div>
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 border-b-2 border-x-2 border-white/50 rounded-b-lg"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-24 border-t-2 border-x-2 border-white/50 rounded-t-lg"></div>
                    <div className="w-full h-full bg-[linear-gradient(0deg,transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_10%]"></div>
                </div>

                {Object.entries(POSITIONS).map(([posKey, style]) => {
                    const player = squad[posKey];
                    return (
                        <div
                            key={posKey}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-all active:scale-95 group"
                            style={style}
                            onClick={() => handlePositionClick(posKey)}
                        >
                            {player ? (
                                <>
                                    <div className="relative">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-b from-blue-800 to-blue-900 border-2 border-yellow-400 shadow-lg flex items-center justify-center overflow-hidden z-10 relative">
                                            {player.photo ? (
                                                <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-bold text-sm">{player.number || '?'}</span>
                                            )}

                                            {player.status?.type === 'injured' && (
                                                <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm z-20">
                                                    <AlertCircle size={12} className="text-red-600" fill="currentColor" />
                                                </div>
                                            )}
                                        </div>
                                        <button
                                            onClick={(e) => removePlayer(e, posKey)}
                                            className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                        >
                                            <X size={10} />
                                        </button>
                                    </div>
                                    <div className="mt-1 bg-blue-900/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white font-semibold border border-blue-700/50 shadow-sm whitespace-nowrap max-w-[80px] truncate">
                                        {player.name.split(' ').pop()}
                                    </div>
                                </>
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors">
                                    <Plus size={20} className="text-white/50" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl max-h-[80vh] flex flex-col border border-slate-800 shadow-2xl">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                            <h3 className="text-white font-bold">Oyuncu Seç</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-2 space-y-1">
                            {players.map((player) => {
                                const status = getPlayerStatus(player);
                                return (
                                    <button
                                        key={player.id}
                                        onClick={() => handlePlayerSelect(player)}
                                        className="w-full flex items-center justify-between p-3 hover:bg-slate-800 rounded-xl transition-colors group text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center overflow-hidden border border-blue-800">
                                                {player.photo ? (
                                                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-yellow-400 font-bold text-xs">{player.number || '-'}</span>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium text-sm">{player.name}</p>
                                                <p className="text-slate-500 text-xs">{player.position}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {status?.type === 'injured' && (
                                                <span className="flex items-center gap-1 text-[10px] bg-red-900/30 text-red-400 px-2 py-1 rounded-full border border-red-900/50">
                                                    <AlertCircle size={12} /> {status.reason || 'Sakat'}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SquadBuilder;
