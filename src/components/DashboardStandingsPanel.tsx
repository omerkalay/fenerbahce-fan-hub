import { useEffect, useState } from 'react';
import { fetchUefaJourneySummary } from '../services/api';
import type { UefaJourneySummary } from '../types';

type StandingsLeague = 'superlig' | 'uefa';

interface DashboardStandingsPanelProps {
    onOpen: (league: StandingsLeague) => void;
    seasonStartYear: number;
    className?: string;
}

const DashboardStandingsPanel: React.FC<DashboardStandingsPanelProps> = ({
    onOpen,
    seasonStartYear,
    className = ''
}) => {
    const [uefaSummary, setUefaSummary] = useState<UefaJourneySummary | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchUefaJourneySummary(seasonStartYear).then((summary) => {
            if (!cancelled) setUefaSummary(summary);
        });
        return () => { cancelled = true; };
    }, [seasonStartYear]);

    const uefaTitle = uefaSummary?.competitionName
        ? uefaSummary.title
        : 'Avrupa Yolculuğu';
    const uefaSubtitle = [
        uefaSummary?.competitionName ? null : uefaSummary?.qualifierName?.replace(/^UEFA\s+/i, ''),
        uefaSummary?.phaseLabel
    ].filter(Boolean).join(' · ');

    return (
        <div className={`glass-panel rounded-2xl p-4 mb-6 ${className}`}>
            <h3 className="text-sm font-bold text-white mb-3">Lig ve Avrupa</h3>
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => onOpen('superlig')}
                    className="px-4 py-3 bg-yellow-400/5 hover:bg-yellow-400/90 text-yellow-400/80 hover:text-black border border-yellow-400/20 hover:border-yellow-400/80 rounded-xl text-sm font-bold transition-all duration-300 hover:scale-105 hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                    Süper Lig
                </button>
                <button
                    onClick={() => onOpen('uefa')}
                    className="min-w-0 px-3 py-3 bg-yellow-400/5 hover:bg-yellow-400/90 text-yellow-400/80 hover:text-black border border-yellow-400/20 hover:border-yellow-400/80 rounded-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_15px_rgba(234,179,8,0.2)]"
                >
                    <span className="block truncate text-sm font-bold">{uefaTitle}</span>
                    {uefaSubtitle && (
                        <span className="mt-0.5 block truncate text-[9px] font-medium opacity-70">
                            {uefaSubtitle}
                        </span>
                    )}
                </button>
            </div>
        </div>
    );
};

export default DashboardStandingsPanel;
