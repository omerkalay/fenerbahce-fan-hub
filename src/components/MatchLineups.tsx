import { useEffect, useState } from 'react';
import { fetchSquad } from '../services/api';
import { localizeTeamName } from '../utils/localize';
import { buildSquadPhotoMaps, normalizeLookupKey } from '../utils/squadPhotoLookup';
import type { SquadPhotoMaps } from '../utils/squadPhotoLookup';
import type { MatchLineups as MatchLineupsType } from '../types';
import { formatSoccerMinute } from './match-lineups/formation-engine';
import MiniPitch from './match-lineups/MiniPitch';
import BenchList from './match-lineups/BenchList';
import SubstitutionList from './match-lineups/SubstitutionList';

const FENERBAHCE_NAMES = ['fenerbahce', 'fenerbahce sk'];

const normalizeTeamKey = (value: string): string =>
    localizeTeamName(String(value || '')).trim().toLocaleLowerCase('tr-TR')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const isFenerbahce = (name: string): boolean => {
    const normalized = normalizeTeamKey(name);
    return FENERBAHCE_NAMES.some((fb) => normalized.includes(fb));
};

const EMPTY_PHOTO_MAPS: SquadPhotoMaps = { byJersey: {}, byName: {}, byAlias: {} };

interface MatchLineupsProps {
    lineups: MatchLineupsType;
    homeTeamName?: string;
    awayTeamName?: string;
    matchId?: string;
}

function MatchLineups({ lineups, homeTeamName, awayTeamName, matchId }: MatchLineupsProps) {
    const homeName = homeTeamName || lineups.home?.teamName || 'Ev Sahibi';
    const awayName = awayTeamName || lineups.away?.teamName || 'Deplasman';
    const localizedHomeName = localizeTeamName(homeName);
    const localizedAwayName = localizeTeamName(awayName);
    const homeIsFb = isFenerbahce(homeName);
    const awayIsFb = isFenerbahce(awayName);
    const defaultTab: 'home' | 'away' = homeIsFb ? 'home' : 'away';
    const [activeTab, setActiveTab] = useState<'home' | 'away'>(defaultTab);
    const [photoMaps, setPhotoMaps] = useState<SquadPhotoMaps>(EMPTY_PHOTO_MAPS);
    const hasPhotoMaps = Object.keys(photoMaps.byJersey).length > 0 || Object.keys(photoMaps.byName).length > 0 || Object.keys(photoMaps.byAlias).length > 0;

    useEffect(() => {
        setActiveTab(defaultTab);
    }, [matchId, defaultTab]);

    useEffect(() => {
        if ((!homeIsFb && !awayIsFb) || hasPhotoMaps) return;

        let mounted = true;
        fetchSquad()
            .then((squad) => {
                if (!mounted) return;
                setPhotoMaps(buildSquadPhotoMaps(squad));
            })
            .catch((error) => {
                console.error('Lineup squad photo load error:', error);
            });

        return () => {
            mounted = false;
        };
    }, [awayIsFb, hasPhotoMaps, homeIsFb]);

    const tabs: { key: 'home' | 'away'; label: string }[] = homeIsFb
        ? [
            { key: 'home', label: localizedHomeName },
            { key: 'away', label: localizedAwayName }
        ]
        : awayIsFb
            ? [
                { key: 'away', label: localizedAwayName },
                { key: 'home', label: localizedHomeName }
            ]
            : [
                { key: 'home', label: localizedHomeName },
                { key: 'away', label: localizedAwayName }
            ];

    const activeLineup = activeTab === 'home' ? lineups.home : lineups.away;
    if (!activeLineup) return null;

    const activeTeamName = activeTab === 'home' ? homeName : awayName;
    const activeTeamIsFb = isFenerbahce(activeTeamName);
    const subOutByPlayer = new Map<string, string>();
    const subInByPlayer = new Map<string, string>();

    activeLineup.substitutions.forEach((sub) => {
        const formattedMinute = formatSoccerMinute(sub.minute);
        if (sub.playerOut) subOutByPlayer.set(normalizeLookupKey(sub.playerOut), formattedMinute);
        if (sub.playerIn) subInByPlayer.set(normalizeLookupKey(sub.playerIn), formattedMinute);
    });

    return (
        <div className="glass-panel rounded-xl p-4">
            <h4 className="mb-3 text-sm font-bold text-white">Kadro</h4>

            <div className="mb-4 flex rounded-lg bg-white/5 p-0.5">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                            activeTab === tab.key
                                ? 'bg-yellow-400 text-black shadow-sm'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <MiniPitch
                lineup={activeLineup}
                isFenerbahceTeam={activeTeamIsFb}
                photoMaps={photoMaps}
                subOutByPlayer={subOutByPlayer}
            />

            <BenchList bench={activeLineup.bench} subInByPlayer={subInByPlayer} />
            <SubstitutionList substitutions={activeLineup.substitutions} />
        </div>
    );
}

export default MatchLineups;
