import React, { useState, useEffect } from 'react';
import { fetchSquad } from '../services/api';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1680;

const parsePercent = (value = '0') => {
    const numeric = parseFloat(String(value).replace('%', ''));
    if (Number.isNaN(numeric)) return 0;
    return numeric / 100;
};

const getPlayerLabel = (name = '') => {
    if (!name) return '';
    const parts = name.trim().split(' ');
    return parts[parts.length - 1] || name;
};

const loadImage = async (src) => {
    if (!src) return null;
    try {
        const response = await fetch(src, { mode: 'cors' });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const img = new Image();
        await new Promise((resolve, reject) => {
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
        return { img, url }; // Return both image and url to revoke later
    } catch (error) {
        console.error('Error loading image:', src, error);
        return null;
    }
};

const drawRoundedRect = (ctx, x, y, width, height, radius = 12, fillStyle = 'rgba(15,23,42,0.9)', strokeStyle = null, lineWidth = 1) => {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }
    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
};

const FormationBuilder = () => {
    const [squad, setSquad] = useState([]);
    const [pitchPlayers, setPitchPlayers] = useState({});
    const [formation, setFormation] = useState('4-2-3-1');
    const [loading, setLoading] = useState(true);
    const [showPlayerModal, setShowPlayerModal] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [playerSearch, setPlayerSearch] = useState('');
    const [isExporting, setIsExporting] = useState(false);

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
        if (!filledSpots || isExporting) return;
        setIsExporting(true);

        let objectUrlsToRevoke = [];

        try {
            const lineupEntries = Object.entries(currentPositions)
                .map(([posKey, style]) => {
                    const player = pitchPlayers[posKey];
                    if (!player) return null;
                    return { style, player };
                })
                .filter(Boolean);

            if (!lineupEntries.length) {
                window.alert('Önce sahaya oyuncu yerleştirmelisin.');
                return;
            }

            const uniquePlayers = [];
            const mapped = new Map();
            lineupEntries.forEach(({ player }) => {
                if (!mapped.has(player.id)) {
                    mapped.set(player.id, true);
                    uniquePlayers.push(player);
                }
            });

            const imageEntries = await Promise.all(
                uniquePlayers.map(async (player) => {
                    const result = await loadImage(player.photo);
                    if (result) {
                        objectUrlsToRevoke.push(result.url);
                        return [player.id, result.img];
                    }
                    return [player.id, null];
                })
            );
            const imageMap = new Map(imageEntries);

            const canvas = document.createElement('canvas');
            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingQuality = 'high';

            const backgroundGradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            backgroundGradient.addColorStop(0, '#030712');
            backgroundGradient.addColorStop(1, '#050f24');
            ctx.fillStyle = backgroundGradient;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#facc15';
            ctx.font = '700 72px "Inter", "SF Pro Display", sans-serif';
            ctx.fillText('Fenerbahçe Hub', CANVAS_WIDTH / 2, 110);
            ctx.fillStyle = '#cbd5f5';
            ctx.font = '500 32px "Inter", "SF Pro Display", sans-serif';
            ctx.fillText('Efsane 11 Kadrom', CANVAS_WIDTH / 2, 170);

            const pitch = {
                x: CANVAS_WIDTH * 0.1,
                y: CANVAS_HEIGHT * 0.22,
                width: CANVAS_WIDTH * 0.8,
                height: CANVAS_HEIGHT * 0.66
            };

            const pitchGradient = ctx.createLinearGradient(0, pitch.y, 0, pitch.y + pitch.height);
            pitchGradient.addColorStop(0, '#15803d');
            pitchGradient.addColorStop(1, '#0c7530');
            drawRoundedRect(ctx, pitch.x, pitch.y, pitch.width, pitch.height, 60, pitchGradient);

            drawRoundedRect(
                ctx,
                pitch.x + 30,
                pitch.y + 30,
                pitch.width - 60,
                pitch.height - 60,
                40,
                null,
                'rgba(255,255,255,0.65)',
                6
            );

            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(pitch.x + pitch.width / 2, pitch.y + 30);
            ctx.lineTo(pitch.x + pitch.width / 2, pitch.y + pitch.height - 30);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(pitch.x + pitch.width / 2, pitch.y + pitch.height / 2, pitch.width * 0.12, 0, Math.PI * 2);
            ctx.stroke();

            const penaltyHeight = pitch.height * 0.18;
            const penaltyWidth = pitch.width * 0.36;
            ctx.strokeRect(pitch.x + pitch.width / 2 - penaltyWidth / 2, pitch.y + 30, penaltyWidth, penaltyHeight);
            ctx.strokeRect(
                pitch.x + pitch.width / 2 - penaltyWidth / 2,
                pitch.y + pitch.height - penaltyHeight - 30,
                penaltyWidth,
                penaltyHeight
            );

            const circleRadius = pitch.width * 0.07;
            ctx.font = '600 36px "Inter", "SF Pro Display", sans-serif';

            lineupEntries.forEach(({ player, style }) => {
                const leftRatio = parsePercent(style.left);
                const topRatio = parsePercent(style.top);
                const centerX = pitch.x + pitch.width * leftRatio;
                const centerY = pitch.y + pitch.height * topRatio;

                ctx.beginPath();
                ctx.arc(centerX, centerY, circleRadius + 12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(15,23,42,0.6)';
                ctx.fill();

                ctx.beginPath();
                ctx.arc(centerX, centerY, circleRadius + 12, 0, Math.PI * 2);
                ctx.lineWidth = 10;
                ctx.strokeStyle = '#facc15';
                ctx.stroke();

                const image = imageMap.get(player.id);
                if (image) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(
                        image,
                        centerX - circleRadius,
                        centerY - circleRadius,
                        circleRadius * 2,
                        circleRadius * 2
                    );
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.font = '700 48px "Inter", "SF Pro Display", sans-serif';
                    ctx.fillText(player.number || '?', centerX, centerY);
                }

                const label = getPlayerLabel(player.name);
                ctx.font = '600 34px "Inter", "SF Pro Display", sans-serif';
                const textWidth = ctx.measureText(label).width;
                const labelWidth = textWidth + 48;
                const labelHeight = 54;
                const labelX = centerX - labelWidth / 2;
                const labelY = centerY + circleRadius + 24;
                drawRoundedRect(ctx, labelX, labelY, labelWidth, labelHeight, 20, 'rgba(15,23,42,0.9)');
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, centerX, labelY + labelHeight / 2);
            });

            const date = new Date().toISOString().split('T')[0];
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((result) => {
                    if (result) resolve(result);
                    else reject(new Error('Kart oluşturulamadı'));
                }, 'image/png', 0.95);
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `fenerbahce-${formation.replace(/[^0-9a-z-]/gi, '')}-lineup-${date}.png`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Kadro kartı indirilirken hata oluştu:', error);
            window.alert(`Kart indirilirken bir hata oluştu: ${error.message}`);
        } finally {
            // Cleanup object URLs
            objectUrlsToRevoke.forEach(url => URL.revokeObjectURL(url));
            setIsExporting(false);
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
                            disabled={!filledSpots || isExporting}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${filledSpots && !isExporting
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                    : 'bg-white/5 text-slate-500 border border-white/10 cursor-not-allowed'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 17h16M7 4v3m0 10v3m10-16v3m0 10v3" />
                            </svg>
                            {isExporting ? 'Hazırlanıyor...' : 'Kart İndir'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Pitch - Using SVG background */}
            <div
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
