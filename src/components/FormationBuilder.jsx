import React, { useState, useEffect, useRef } from 'react';
import { fetchSquad } from '../services/api';
import html2canvas from 'html2canvas';

const FormationBuilder = () => {
    const [squad, setSquad] = useState([]);
    const [pitchPlayers, setPitchPlayers] = useState({});
    const [formation, setFormation] = useState('4-2-3-1');
    const [loading, setLoading] = useState(true);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [playerSearch, setPlayerSearch] = useState('');
    const pitchRef = useRef(null);

    useEffect(() => {
        const loadSquad = async () => {
            const data = await fetchSquad();
            setSquad(data);
            setLoading(false);
        };
        loadSquad();
    }, []);

    const handleDragStart = (e, player) => {
        e.dataTransfer.setData('player', JSON.stringify(player));
    };

    const handleDrop = (e, positionKey) => {
        e.preventDefault();
        const player = JSON.parse(e.dataTransfer.getData('player'));

        const isAlreadyOnPitch = Object.values(pitchPlayers).some(p => p.id === player.id);
        if (isAlreadyOnPitch) {
            return;
        }

        setPitchPlayers(prev => ({
            ...prev,
            [positionKey]: player
        }));
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

    const formations = {
        '4-3-3': {
            GK: { top: '92%', left: '50%' },
            LB: { top: '75%', left: '15%' },
            CB1: { top: '75%', left: '37%' },
            CB2: { top: '75%', left: '63%' },
            RB: { top: '75%', left: '85%' },
            CM1: { top: '48%', left: '30%' },
            CM2: { top: '48%', left: '50%' },
            CM3: { top: '48%', left: '70%' },
            LW: { top: '25%', left: '15%' },
            ST: { top: '18%', left: '50%' },
            RW: { top: '25%', left: '85%' }
        },
        '4-4-2': {
            GK: { top: '92%', left: '50%' },
            LB: { top: '75%', left: '15%' },
            CB1: { top: '75%', left: '37%' },
            CB2: { top: '75%', left: '63%' },
            RB: { top: '75%', left: '85%' },
            LM: { top: '48%', left: '15%' },
            CM1: { top: '48%', left: '37%' },
            CM2: { top: '48%', left: '63%' },
            RM: { top: '48%', left: '85%' },
            ST1: { top: '20%', left: '37%' },
            ST2: { top: '20%', left: '63%' }
        },
        '4-2-3-1': {
            GK: { top: '92%', left: '50%' },
            LB: { top: '75%', left: '15%' },
            CB1: { top: '75%', left: '37%' },
            CB2: { top: '75%', left: '63%' },
            RB: { top: '75%', left: '85%' },
            CDM1: { top: '58%', left: '37%' },
            CDM2: { top: '58%', left: '63%' },
            LAM: { top: '35%', left: '15%' },
            CAM: { top: '30%', left: '50%' },
            RAM: { top: '35%', left: '85%' },
            ST: { top: '18%', left: '50%' }
        },
        '4-1-4-1': {
            GK: { top: '92%', left: '50%' },
            LB: { top: '75%', left: '15%' },
            CB1: { top: '75%', left: '37%' },
            CB2: { top: '75%', left: '63%' },
            RB: { top: '75%', left: '85%' },
            CDM: { top: '60%', left: '50%' },
            LM: { top: '42%', left: '15%' },
            CM1: { top: '42%', left: '37%' },
            CM2: { top: '42%', left: '63%' },
            RM: { top: '42%', left: '85%' },
            ST: { top: '18%', left: '50%' }
        },
        '3-5-2': {
            GK: { top: '92%', left: '50%' },
            CB1: { top: '75%', left: '25%' },
            CB2: { top: '75%', left: '50%' },
            CB3: { top: '75%', left: '75%' },
            LWB: { top: '52%', left: '10%' },
            CM1: { top: '48%', left: '30%' },
            CM2: { top: '48%', left: '50%' },
            CM3: { top: '48%', left: '70%' },
            RWB: { top: '52%', left: '90%' },
            ST1: { top: '20%', left: '37%' },
            ST2: { top: '20%', left: '63%' }
        }
    };

    const currentPositions = formations[formation];
    const filledSpots = Object.keys(pitchPlayers).length;
    const totalSpots = Object.keys(currentPositions).length;

    const downloadLineupCard = async () => {
        if (!pitchRef.current || !filledSpots) return;

        try {
            const canvas = await html2canvas(pitchRef.current, {
                backgroundColor: '#04151f',
                useCORS: true,
                scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const date = new Date().toISOString().split('T')[0];
            link.href = dataUrl;
            link.download = `fenerbahce-${formation.replace(/[^0-9a-z-]/gi, '')}-lineup-${date}.png`;
            link.click();
        } catch (error) {
            console.error('Kadro kartı indirilirken hata oluştu:', error);
            window.alert('Kart indirilirken bir hata oluştu. Lütfen tekrar deneyin.');
        }
    };

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
                            <p className="text-sm font-semibold text-white">Kart olarak indir</p>
                            <p className="text-[11px] text-slate-400">
                                Tamamlanan kadro: <span className="font-semibold text-white">{filledSpots}/{totalSpots}</span>
                            </p>
                        </div>
                        <button
                            onClick={downloadLineupCard}
                            disabled={!filledSpots}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                                filledSpots
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16M7 4v3m0 10v3m10-16v3m0 10v3" />
                            </svg>
                            Kart İndir
                        </button>
                    </div>
                </div>
            </div>

            {/* Pitch - Using SVG background */}
            <div
                ref={pitchRef}
                className="relative w-full aspect-[2/3] rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl mb-6 mx-auto max-w-sm"
                style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grass' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23166534'/%3E%3Cstop offset='100%25' style='stop-color:%231e7e34'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100' height='150' fill='url(%23grass)'/%3E%3Cg stroke='white' stroke-width='0.5' fill='none' opacity='0.4'%3E%3Crect x='5' y='5' width='90' height='140'/%3E%3Cline x1='5' x2='95' y1='75' y2='75'/%3E%3Ccircle cx='50' cy='75' r='10'/%3E%3Ccircle cx='50' cy='75' r='0.5' fill='white'/%3E%3Crect x='30' y='5' width='40' height='18'/%3E%3Crect x='40' y='5' width='20' height='7'/%3E%3Ccircle cx='50' cy='0.5' r='0.5' fill='white'/%3E%3Cpath d='M 35 23 A 10 10 0 0 0 65 23' /%3E%3Crect x='30' y='127' width='40' height='18'/%3E%3Crect x='40' y='138' width='20' height='7'/%3E%3Ccircle cx='50' cy='149.5' r='0.5' fill='white'/%3E%3Cpath d='M 35 127 A 10 10 0 0 1 65 127' /%3E%3Cpath d='M 5 5 Q 7 7 5 9' /%3E%3Cpath d='M 95 5 Q 93 7 95 9' /%3E%3Cpath d='M 5 145 Q 7 143 5 141' /%3E%3Cpath d='M 95 145 Q 93 143 95 141' /%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
            }}>

                {/* Positions */}
                {Object.entries(currentPositions).map(([posKey, style]) => {
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
                                <div className="relative w-full h-full flex flex-col items-center">
                                    <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden bg-slate-800 shadow-lg relative cursor-pointer">
                                        {player.photo ? (
                                            <img src={player.photo} alt={player.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-bold">{player.number}</div>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`${player.name} pozisyonundan çıkar`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removePlayer(posKey);
                                            }}
                                            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-lg active:scale-95"
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="mt-1 bg-slate-900/90 px-2 py-0.5 rounded text-[9px] text-white font-medium truncate w-20 text-center border border-white/10 backdrop-blur-sm shadow-sm">
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
                <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-20">
                    <div className="grid grid-cols-4 gap-2">
                        {loading ? (
                            <div className="col-span-4 text-center text-slate-500 py-4">Yükleniyor...</div>
                        ) : (
                            squad.map(player => (
                                <div
                                    key={player.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, player)}
                                    className="glass-panel rounded-lg p-2 flex flex-col items-center gap-1 cursor-move active:scale-95 transition-transform hover:bg-white/5"
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden border border-white/10">
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
