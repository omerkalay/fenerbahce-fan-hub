import { useState, useEffect } from 'react';
import { fetchSquad } from '../services/api';
import type { Player } from '../types';

const SquadList = () => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            const squadData = await fetchSquad();
            setPlayers(squadData);
            setLoading(false);
        };
        loadData();
    }, []);

    const groupPlayersByPosition = (playerList: Player[]): Record<string, Player[]> => {
        const groups: Record<string, string[]> = {
            'Kaleciler': ['G', 'GK'],
            'Defans': ['D', 'DF', 'LB', 'RB', 'CB'],
            'Orta Saha': ['M', 'MF', 'DM', 'CM', 'AM', 'LM', 'RM'],
            'Forvet': ['F', 'FW', 'ST', 'LW', 'RW']
        };

        const grouped: Record<string, Player[]> = {
            'Kaleciler': [],
            'Defans': [],
            'Orta Saha': [],
            'Forvet': []
        };

        playerList.forEach(player => {
            let added = false;
            for (const [groupName, positions] of Object.entries(groups)) {
                if (positions.includes(player.position)) {
                    grouped[groupName].push(player);
                    added = true;
                    break;
                }
            }
            if (!added) {
                grouped['Orta Saha'].push(player);
            }
        });

        return grouped;
    };

    if (loading) {
        return <div className="p-10 text-center text-blue-300">Kadro yükleniyor...</div>;
    }

    const groupedPlayers = groupPlayersByPosition(players);

    return (
        <div className="pb-24 p-4">
            <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-yellow-400 uppercase tracking-wider">Fenerbahçe Kadrosu</h1>
                <p className="text-blue-200 text-xs">2024-2025 Sezonu</p>
            </div>

            <div className="space-y-6">
                {Object.entries(groupedPlayers).map(([groupName, groupPlayers]) => (
                    groupPlayers.length > 0 && (
                        <div key={groupName} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                            <div className="bg-blue-900/30 p-3 border-b border-slate-800">
                                <h2 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1 h-4 bg-yellow-500 rounded-full"></span>
                                    {groupName}
                                </h2>
                            </div>
                            <div className="divide-y divide-slate-800/50">
                                {groupPlayers.map(player => (
                                    <div key={player.id} className="p-3 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center overflow-hidden border border-blue-800 shrink-0">
                                            {player.photo ? (
                                                <img src={player.photo} alt={player.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-yellow-400 font-bold text-xs">{player.number || '-'}</span>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-white font-medium text-sm">{player.name}</h3>
                                                <span className="text-yellow-500 font-bold text-lg font-mono">{player.number}</span>
                                            </div>
                                            <p className="text-slate-500 text-xs">{player.position}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                ))}
            </div>
        </div>
    );
};

export default SquadList;
