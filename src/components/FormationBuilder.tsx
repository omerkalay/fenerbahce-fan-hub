import { useState, useEffect, useRef } from 'react';
import { fetchSquad } from '../services/api';
import { toPng } from 'html-to-image';
import { PITCH_SVG, formations, getPositionFamily } from '../data/formations';
import PlayerSelectionModal from './PlayerSelectionModal';
import PlayerPool from './PlayerPool';
import type { Player, FormationName, PitchPlayers, PositionCoord } from '../types';

const FormationBuilder = () => {
    const [squad, setSquad] = useState<Player[]>([]);
    const [pitchPlayers, setPitchPlayers] = useState<PitchPlayers>({});
    const [formation, setFormation] = useState<FormationName>('4-2-3-1');
    const [loading, setLoading] = useState<boolean>(true);
    const [showPlayerModal, setShowPlayerModal] = useState<boolean>(false);
    const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
    const pitchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadSquad = async () => {
            const data = await fetchSquad();
            setSquad(data);
            setLoading(false);
        };
        loadSquad();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || (navigator as Navigator & { msMaxTouchPoints?: number }).msMaxTouchPoints! > 0;
            setIsTouchDevice(hasTouch);
        }
    }, []);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, player: Player) => {
        e.dataTransfer.setData('player', JSON.stringify(player));
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, positionKey: string) => {
        e.preventDefault();
        const player: Player = JSON.parse(e.dataTransfer.getData('player'));
        const sourcePosition = e.dataTransfer.getData('sourcePosition');

        if (sourcePosition) {
            const targetPlayer = pitchPlayers[positionKey];

            setPitchPlayers(prev => {
                const newState = { ...prev };

                if (targetPlayer) {
                    newState[sourcePosition] = targetPlayer;
                    newState[positionKey] = player;
                } else {
                    delete newState[sourcePosition];
                    newState[positionKey] = player;
                }

                return newState;
            });
        } else {
            const isAlreadyOnPitch = Object.values(activePitchPlayers).some(p => p.id === player.id);
            if (isAlreadyOnPitch) {
                return;
            }

            setPitchPlayers(prev => ({
                ...prev,
                [positionKey]: player
            }));
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const removePlayer = (positionKey: string) => {
        setPitchPlayers(prev => {
            const newState = { ...prev };
            delete newState[positionKey];
            return newState;
        });
    };

    const handlePositionClick = (posKey: string) => {
        if (!pitchPlayers[posKey]) {
            setSelectedPosition(posKey);
            setShowPlayerModal(true);
        }
    };

    const handlePlayerSelect = (player: Player) => {
        if (selectedPosition) {
            const isAlreadyOnPitch = Object.values(activePitchPlayers).some(p => p.id === player.id);
            if (!isAlreadyOnPitch) {
                setPitchPlayers(prev => ({
                    ...prev,
                    [selectedPosition]: player
                }));
            }
        }
        setShowPlayerModal(false);
        setSelectedPosition(null);
    };

    useEffect(() => {
        const targetPositionKeys = Object.keys(formations[formation]);

        setPitchPlayers(prev => {
            const next: PitchPlayers = {};
            const assignedPlayerIds = new Set<number>();

            // Keep players that already match the new formation positions.
            for (const key of targetPositionKeys) {
                const player = prev[key];
                if (player) {
                    next[key] = player;
                    assignedPlayerIds.add(player.id);
                }
            }

            // Move hidden players to the first compatible empty slot.
            for (const [sourceKey, player] of Object.entries(prev)) {
                if (next[sourceKey] || assignedPlayerIds.has(player.id)) {
                    continue;
                }

                const sourceFamily = getPositionFamily(sourceKey);
                const fallbackKey = targetPositionKeys.find(targetKey => {
                    if (next[targetKey]) {
                        return false;
                    }
                    return getPositionFamily(targetKey) === sourceFamily;
                });

                if (fallbackKey) {
                    next[fallbackKey] = player;
                    assignedPlayerIds.add(player.id);
                }
            }

            return next;
        });
    }, [formation]);

    const currentPositions = formations[formation];
    const activePositionKeys = Object.keys(currentPositions);
    const activePitchPlayers: PitchPlayers = activePositionKeys.reduce<PitchPlayers>((acc, key) => {
        if (pitchPlayers[key]) {
            acc[key] = pitchPlayers[key];
        }
        return acc;
    }, {});
    const filledSpots = Object.keys(activePitchPlayers).length;
    const totalSpots = Object.keys(currentPositions).length;

    const generateLineupImage = async () => {
        const date = new Date().toISOString().split('T')[0];
        const dataUrl = await toPng(pitchRef.current!, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: '#030712',
            style: { transform: 'scale(1)' }
        });
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const fileName = `fenerbahce-${formation.replace(/[^0-9a-z-]/gi, '')}-lineup-${date}.png`;
        return { blob, fileName, dataUrl };
    };

    const downloadLineupCard = async () => {
        if (!filledSpots || isExporting || !pitchRef.current) return;
        setIsExporting(true);
        try {
            const { dataUrl, fileName } = await generateLineupImage();
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Kadro kartı indirilirken hata oluştu:', error);
            window.alert(`Kart indirilirken bir hata oluştu: ${(error as Error).message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const shareLineupCard = async () => {
        if (!filledSpots || isExporting || !pitchRef.current) return;
        setIsExporting(true);
        try {
            const { blob, fileName } = await generateLineupImage();
            const file = new File([blob], fileName, { type: 'image/png' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'Fenerbahçe Kadrom',
                    text: `Benim ${formation} kadrom! 💛💙`,
                    files: [file]
                });
            } else {
                // Fallback: indirme yap
                downloadLineupCard();
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Paylaşım hatası:', error);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const sortedPositions: [string, PositionCoord][] = Object.entries(currentPositions).sort(([, a], [, b]) => {
        return parseFloat(a.top) - parseFloat(b.top);
    });

    return (
        <div className="h-full flex flex-col pb-20">
            {/* Controls */}
            <div className="flex flex-col gap-3 mb-4 px-2">
                <div className="flex justify-between items-center">
                    <select
                        value={formation}
                        onChange={(e) => setFormation(e.target.value as FormationName)}
                        className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-yellow-400"
                    >
                        {Object.keys(formations).map(f => (
                            <option key={f} value={f}>{f}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setPitchPlayers({})}
                        className="text-xs text-red-400 hover:text-red-300 font-medium px-3 py-2 bg-red-400/10 rounded-lg border border-red-400/20"
                    >
                        Temizle
                    </button>
                </div>

                <div className="glass-panel rounded-xl p-4 flex flex-col gap-3 border border-white/5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-sm font-semibold text-white">Kadro Paylaş</p>
                            <p className="text-[11px] text-slate-400">
                                Tamamlanan kadro: <span className="font-semibold text-white">{filledSpots}/{totalSpots}</span>
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={shareLineupCard}
                                disabled={!filledSpots || isExporting}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${filledSpots && !isExporting
                                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-500/30'
                                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                </svg>
                                {isExporting ? 'Hazırlanıyor...' : 'Paylaş'}
                            </button>
                            <button
                                onClick={downloadLineupCard}
                                disabled={!filledSpots || isExporting}
                                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${filledSpots && !isExporting
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                İndir
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pitch Container */}
            <div
                ref={pitchRef}
                className="relative w-full aspect-[2/3] overflow-hidden mx-auto max-w-sm rounded-xl mb-6"
                style={{
                    backgroundImage: `url("${PITCH_SVG}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}>

                {/* Positions */}
                {sortedPositions.map(([posKey, style]) => {
                    const player = pitchPlayers[posKey];
                    return (
                        <div
                            key={posKey}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center transition-all duration-200"
                            style={style}
                            onDrop={(e) => handleDrop(e, posKey)}
                            onDragOver={handleDragOver}
                            onClick={() => handlePositionClick(posKey)}
                        >
                            {player ? (
                                <div
                                    className="relative w-full h-full flex flex-col items-center group"
                                    draggable={!isExporting && !isTouchDevice}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('player', JSON.stringify(player));
                                        e.dataTransfer.setData('sourcePosition', posKey);
                                    }}
                                >
                                    <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden bg-slate-800 shadow-lg relative cursor-move z-10 group-hover:scale-110 transition-transform">
                                        {player.photo ? (
                                            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold">{player.number}</div>
                                        )}
                                    </div>
                                    {!isExporting && (
                                        <button
                                            type="button"
                                            aria-label={`${player.name} pozisyonundan çıkar`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removePlayer(posKey);
                                            }}
                                            className="absolute top-0 right-0 w-4 h-4 rounded-full bg-slate-900/90 backdrop-blur-sm border border-slate-600/50 flex items-center justify-center shadow-md active:scale-90 transition-all z-20 hover:border-yellow-400/60 hover:bg-slate-800"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5 text-slate-400 group-hover:text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    )}
                                    <div className="mt-1 bg-slate-900/90 px-2 py-0.5 rounded text-[9px] text-white font-medium truncate w-20 text-center border border-white/10 backdrop-blur-sm shadow-sm z-20">
                                        {player.name.split(' ').pop()}
                                    </div>
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-full border-2 border-dashed border-white/40 bg-white/5 flex items-center justify-center hover:bg-white/10 hover:border-yellow-400/50 transition-all cursor-pointer">
                                    <span className="text-2xl text-white/50 hover:text-yellow-400">+</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Player Pool */}
            <PlayerPool
                squad={squad}
                loading={loading}
                isTouchDevice={isTouchDevice}
                onDragStart={handleDragStart}
            />

            {/* Player Selection Modal */}
            <PlayerSelectionModal
                visible={showPlayerModal}
                squad={squad}
                activePitchPlayers={activePitchPlayers}
                onSelect={handlePlayerSelect}
                onClose={() => {
                    setShowPlayerModal(false);
                    setSelectedPosition(null);
                }}
            />
        </div>
    );
};

export default FormationBuilder;
