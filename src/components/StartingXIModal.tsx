import { useState, useEffect } from 'react';
import type { StartingXIData, Player } from '../types';
import { fetchSquad } from '../services/api';

interface StartingXIModalProps {
    visible: boolean;
    data: StartingXIData;
    onClose: () => void;
}

const StartingXIModal: React.FC<StartingXIModalProps> = ({ visible, data, onClose }) => {
    const [squad, setSquad] = useState<Player[]>([]);

    useEffect(() => {
        if (!visible || squad.length > 0) return;
        fetchSquad().then((s) => {
            setSquad(s);
        });
    }, [visible, squad.length]);

    if (!visible) return null;

    const photoByNumber = new Map(
        squad.filter(p => p.number != null).map(p => [Number(p.number), p.photo])
    );

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md max-h-[88vh] overflow-hidden glass-card rounded-2xl border border-yellow-400/20 animate-slideUp"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <p className="text-base font-bold text-white">İlk 11 Açıklandı!</p>
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

                <div className="w-full overflow-y-auto max-h-[calc(88vh-60px)] p-4">
                    <div className="space-y-0">
                        {data.starters.map((player, idx) => (
                            <div key={`s-${idx}`} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
                                <div className="w-8 h-8 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                                    {photoByNumber.get(player.number) ? (
                                        <img
                                            src={photoByNumber.get(player.number)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-slate-500">
                                            {player.number}
                                        </div>
                                    )}
                                </div>
                                <span className="text-sm font-bold text-yellow-400/80 w-7 text-right">{player.number}</span>
                                <span className="text-sm text-white font-medium">{player.name}</span>
                            </div>
                        ))}
                    </div>

                    {data.bench && data.bench.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/10">
                            <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">Yedekler</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {data.bench.map((player, idx) => (
                                    <div key={`b-${idx}`} className="flex items-center gap-2 py-1">
                                        <div className="w-6 h-6 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
                                            {photoByNumber.get(player.number) ? (
                                                <img
                                                    src={photoByNumber.get(player.number)}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                    {player.number}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400 truncate">{player.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StartingXIModal;
