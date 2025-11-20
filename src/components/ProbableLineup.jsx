import React, { useState, useEffect } from 'react';
import { fetchSquad } from '../services/api';

const ProbableLineup = () => {
    const [squad, setSquad] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSquad = async () => {
            const data = await fetchSquad();
            setSquad(data);
            setLoading(false);
        };
        loadSquad();
    }, []);

    // Mock Probable 11 Logic: Select best players by value or just specific names if known.
    // For now, let's pick a 4-2-3-1 formation based on positions.
    const getProbable11 = () => {
        if (!squad.length) return [];

        // Helper to find player by position (simplified)
        const find = (pos) => squad.find(p => p.position === pos && !usedIds.has(p.id));
        const usedIds = new Set();

        const lineup = [
            { pos: 'GK', ...squad.find(p => p.position === 'G') },
            { pos: 'RB', ...squad.find(p => p.position === 'D' && (p.name.includes('Osayi') || p.name.includes('Müldür'))) },
            { pos: 'CB', ...squad.find(p => p.position === 'D' && p.name.includes('Becão')) },
            { pos: 'CB', ...squad.find(p => p.position === 'D' && p.name.includes('Djiku')) }, // Fallback if Djiku not found, pick another D
            { pos: 'LB', ...squad.find(p => p.position === 'D' && (p.name.includes('Ferdi') || p.name.includes('Oosterwolde'))) },
            { pos: 'CDM', ...squad.find(p => p.position === 'M' && p.name.includes('Yüksek')) },
            { pos: 'CDM', ...squad.find(p => p.position === 'M' && p.name.includes('Fred')) },
            { pos: 'RW', ...squad.find(p => p.position === 'M' && p.name.includes('Kahveci')) },
            { pos: 'CAM', ...squad.find(p => p.position === 'M' && p.name.includes('Szymański')) },
            { pos: 'LW', ...squad.find(p => p.position === 'F' && p.name.includes('Tadić')) },
            { pos: 'ST', ...squad.find(p => p.position === 'F' && p.name.includes('Džeko')) },
        ];

        // Fill gaps if specific players aren't found (fallback logic)
        return lineup.map((p, index) => {
            if (!p.id) {
                // Find any player of roughly correct position not used
                const fallback = squad.find(s => !usedIds.has(s.id));
                if (fallback) {
                    usedIds.add(fallback.id);
                    return { ...fallback, pos: p.pos };
                }
            } else {
                usedIds.add(p.id);
            }
            return p;
        }).filter(p => p && p.id);
    };

    const probable11 = getProbable11();

    // Position coordinates for 4-2-3-1
    const positions = {
        'GK': { top: '85%', left: '50%' },
        'RB': { top: '70%', left: '85%' },
        'CB': { top: '70%', left: '65%' }, // Right CB
        'CB2': { top: '70%', left: '35%' }, // Left CB (mapped manually in render)
        'LB': { top: '70%', left: '15%' },
        'CDM': { top: '50%', left: '65%' },
        'CDM2': { top: '50%', left: '35%' },
        'RW': { top: '30%', left: '85%' },
        'CAM': { top: '35%', left: '50%' },
        'LW': { top: '30%', left: '15%' },
        'ST': { top: '10%', left: '50%' }
    };

    if (loading) return <div className="text-white text-center mt-10">Yükleniyor...</div>;

    return (
        <div className="h-full flex flex-col">
            <h2 className="text-2xl font-bold text-white mb-4 text-center text-glow">Muhtemel 11</h2>

            <div className="flex-1 relative bg-green-800/80 rounded-xl border-2 border-white/20 overflow-hidden shadow-2xl mx-4 mb-20">
                {/* Pitch Markings */}
                <div className="absolute inset-0 opacity-30 pointer-events-none">
                    <div className="absolute top-0 bottom-0 left-0 right-0 border-2 border-white m-4"></div>
                    <div className="absolute top-0 bottom-0 left-1/2 border-l-2 border-white -translate-x-1/2"></div>
                    <div className="absolute top-1/2 left-1/2 w-32 h-32 border-2 border-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute top-0 left-1/2 w-48 h-24 border-2 border-t-0 border-white -translate-x-1/2"></div>
                    <div className="absolute bottom-0 left-1/2 w-48 h-24 border-2 border-b-0 border-white -translate-x-1/2"></div>
                </div>

                {/* Players */}
                {probable11.map((player, index) => {
                    // Map index to position key for 4-2-3-1 specific layout
                    const posKeys = ['GK', 'RB', 'CB', 'CB2', 'LB', 'CDM', 'CDM2', 'RW', 'CAM', 'LW', 'ST'];
                    const posKey = posKeys[index] || 'GK';
                    const style = positions[posKey];

                    return (
                        <div
                            key={player.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center w-20"
                            style={style}
                        >
                            <div className="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden bg-slate-800 shadow-lg relative">
                                {player.photo ? (
                                    <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs font-bold">{player.number}</div>
                                )}
                            </div>
                            <div className="mt-1 bg-slate-900/80 px-2 py-0.5 rounded text-[10px] text-white font-medium truncate w-full text-center border border-white/10 backdrop-blur-sm">
                                {player.name.split(' ').pop()}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ProbableLineup;
