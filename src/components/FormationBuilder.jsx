import React, { useState, useEffect, useRef } from 'react';
import { fetchSquad } from '../services/api';
import { toPng } from 'html-to-image';

const PITCH_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg viewBox="0 0 68 105" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grass" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#1a472a"/><stop offset="50%" style="stop-color:#166534"/><stop offset="100%" style="stop-color:#1a472a"/></linearGradient></defs><rect width="68" height="105" fill="url(#grass)"/><g stroke="rgba(255,255,255,0.5)" stroke-width="0.4" fill="none"><rect x="4" y="4" width="60" height="97"/><line x1="4" y1="52.5" x2="64" y2="52.5"/><circle cx="34" cy="52.5" r="9.15"/><circle cx="34" cy="52.5" r="0.5" fill="rgba(255,255,255,0.5)"/><rect x="13.84" y="4" width="40.32" height="16.5"/><rect x="24.84" y="4" width="18.32" height="5.5"/><circle cx="34" cy="15" r="0.5" fill="rgba(255,255,255,0.5)"/><path d="M 25.5 20.5 A 9.15 9.15 0 0 0 42.5 20.5"/><rect x="13.84" y="84.5" width="40.32" height="16.5"/><rect x="24.84" y="95.5" width="18.32" height="5.5"/><circle cx="34" cy="90" r="0.5" fill="rgba(255,255,255,0.5)"/><path d="M 25.5 84.5 A 9.15 9.15 0 0 1 42.5 84.5"/><path d="M 4 6 A 2 2 0 0 0 6 4"/><path d="M 62 4 A 2 2 0 0 0 64 6"/><path d="M 4 99 A 2 2 0 0 1 6 101"/><path d="M 62 101 A 2 2 0 0 1 64 99"/></g></svg>`)}`;

const FormationBuilder = () => {
    const [squad, setSquad] = useState([]);
    const [pitchPlayers, setPitchPlayers] = useState({});
    const [formation, setFormation] = useState('4-2-3-1');
    const [loading, setLoading] = useState(true);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [playerSearch, setPlayerSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const pitchRef = useRef(null);

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
            const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
            setIsTouchDevice(hasTouch);
        }
    }, []);

    const handleDragStart = (e, player) => {
        e.dataTransfer.setData('player', JSON.stringify(player));
    };

    const handleDrop = (e, positionKey) => {
        e.preventDefault();
        const player = JSON.parse(e.dataTransfer.getData('player'));
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
            const isAlreadyOnPitch = Object.values(pitchPlayers).some(p => p.id === player.id);
            if (isAlreadyOnPitch) {
                return;
            }

            setPitchPlayers(prev => ({
                ...prev,
                [positionKey]: player
            }));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const removePlayer = (positionKey) => {
        setPitchPlayers(prev => {
            const newState = { ...prev };
            delete newState[positionKey];
            return newState;
        });
    };

    const handlePositionClick = (posKey) => {
        if (!pitchPlayers[posKey]) {
            setSelectedPosition(posKey);
            setShowPlayerModal(true);
        }
    };

    const handlePlayerSelect = (player) => {
        if (selectedPosition) {
            const isAlreadyOnPitch = Object.values(pitchPlayers).some(p => p.id === player.id);
            if (!isAlreadyOnPitch) {
                setPitchPlayers(prev => ({
                    ...prev,
                    [selectedPosition]: player
                }));
            }
        }
        setShowPlayerModal(false);
        setSelectedPosition(null);
        setPlayerSearch('');
    };

    // Pozisyonlar saha çizgilerine göre optimize edildi
    const formations = {
        '4-3-3': {
            GK: { top: '93%', left: '50%' },
            LB: { top: '78%', left: '12%' },
            CB1: { top: '78%', left: '35%' },
            CB2: { top: '78%', left: '65%' },
            RB: { top: '78%', left: '88%' },
            CM1: { top: '50%', left: '28%' },
            CM2: { top: '50%', left: '50%' },
            CM3: { top: '50%', left: '72%' },
            LW: { top: '25%', left: '12%' },
            ST: { top: '15%', left: '50%' },
            RW: { top: '25%', left: '88%' }
        },
        '4-4-2': {
            GK: { top: '93%', left: '50%' },
            LB: { top: '78%', left: '12%' },
            CB1: { top: '78%', left: '35%' },
            CB2: { top: '78%', left: '65%' },
            RB: { top: '78%', left: '88%' },
            LM: { top: '50%', left: '12%' },
            CM1: { top: '50%', left: '35%' },
            CM2: { top: '50%', left: '65%' },
            RM: { top: '50%', left: '88%' },
            ST1: { top: '18%', left: '35%' },
            ST2: { top: '18%', left: '65%' }
        },
        '4-2-3-1': {
            GK: { top: '93%', left: '50%' },
            LB: { top: '78%', left: '12%' },
            CB1: { top: '78%', left: '35%' },
            CB2: { top: '78%', left: '65%' },
            RB: { top: '78%', left: '88%' },
            CDM1: { top: '60%', left: '35%' },
            CDM2: { top: '60%', left: '65%' },
            LAM: { top: '35%', left: '15%' },
            CAM: { top: '32%', left: '50%' },
            RAM: { top: '35%', left: '85%' },
            ST: { top: '15%', left: '50%' }
        },
        '4-1-4-1': {
            GK: { top: '93%', left: '50%' },
            LB: { top: '78%', left: '12%' },
            CB1: { top: '78%', left: '35%' },
            CB2: { top: '78%', left: '65%' },
            RB: { top: '78%', left: '88%' },
            CDM: { top: '62%', left: '50%' },
            LM: { top: '45%', left: '12%' },
            CM1: { top: '45%', left: '35%' },
            CM2: { top: '45%', left: '65%' },
            RM: { top: '45%', left: '88%' },
            ST: { top: '15%', left: '50%' }
        },
        '3-5-2': {
            GK: { top: '93%', left: '50%' },
            CB1: { top: '78%', left: '25%' },
            CB2: { top: '78%', left: '50%' },
            CB3: { top: '78%', left: '75%' },
            LWB: { top: '55%', left: '8%' },
            CM1: { top: '50%', left: '28%' },
            CM2: { top: '50%', left: '50%' },
            CM3: { top: '50%', left: '72%' },
            RWB: { top: '55%', left: '92%' },
            ST1: { top: '18%', left: '35%' },
            ST2: { top: '18%', left: '65%' }
        }
    };

    const currentPositions = formations[formation];
    const filledSpots = Object.keys(pitchPlayers).length;
    const totalSpots = Object.keys(currentPositions).length;

    const generateLineupImage = async () => {
        const date = new Date().toISOString().split('T')[0];
        const dataUrl = await toPng(pitchRef.current, {
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
            window.alert(`Kart indirilirken bir hata oluştu: ${error.message}`);
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
            if (error.name !== 'AbortError') {
                console.error('Paylaşım hatası:', error);
            }
        } finally {
            setIsExporting(false);
        }
    };

    const sortedPositions = Object.entries(currentPositions).sort(([, a], [, b]) => {
        return parseFloat(a.top) - parseFloat(b.top);
    });

    return (
        <div className="h-full flex flex-col pb-20">
            {/* Controls */}
            <div className="flex flex-col gap-3 mb-4 px-2">
                <div className="flex justify-between items-center">
                    <select
                        value={formation}
                        onChange={(e) => setFormation(e.target.value)}
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
            <div className="flex-1 overflow-hidden flex flex-col">
                <h3 className="text-sm font-bold text-slate-400 mb-2 px-2 uppercase tracking-wider">Oyuncular</h3>
                <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-20 touch-pan-y">
                    <div className="grid grid-cols-4 gap-2">
                        {loading ? (
                            <div className="col-span-4 text-center text-slate-500 py-4">Yükleniyor...</div>
                        ) : (
                            squad.map(player => (
                                <div
                                    key={player.id}
                                    draggable={!isTouchDevice}
                                    onDragStart={(e) => handleDragStart(e, player)}
                                    className="glass-panel rounded-lg p-2 flex flex-col items-center gap-1 cursor-move active:scale-95 transition-transform hover:bg-white/5"
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

            {/* Player Selection Modal */}
            {showPlayerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => {
                    setShowPlayerModal(false);
                    setPlayerSearch('');
                }}>
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
                                onClick={() => {
                                    setShowPlayerModal(false);
                                    setPlayerSearch('');
                                }}
                                className="text-slate-400 hover:text-white"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto no-scrollbar">
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
                                        const isAlreadyOnPitch = Object.values(pitchPlayers).some(p => p.id === player.id);
                                        return (
                                            <button
                                                key={player.id}
                                                onClick={() => handlePlayerSelect(player)}
                                                disabled={isAlreadyOnPitch}
                                                className={`glass-panel rounded-lg p-2 flex flex-col items-center gap-1 transition-all ${isAlreadyOnPitch
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : 'hover:bg-yellow-400/20 hover:border-yellow-400/30 cursor-pointer'
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
            )}
        </div>
    );
};

export default FormationBuilder;
