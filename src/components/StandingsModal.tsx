import { useEffect, useMemo, useState } from 'react';
import CustomStandings from './CustomStandings';
import SeasonSelector from './SeasonSelector';
import { fetchUefaJourney } from '../services/api';
import type { UefaJourneyPayload } from '../types';
import { getCurrentSeasonStartYear, getRecentSeasonOptions } from '../utils/seasons';
import { EmptyState, UefaBracketView, UefaPathView } from './UefaJourneyContent';

type StandingsLeague = 'superlig' | 'uefa';
type UefaTab = 'path' | 'standings' | 'bracket';

interface StandingsModalProps {
    visible: boolean;
    league: StandingsLeague | string;
    initialSeasonStartYear?: number;
    onClose: () => void;
}

const StandingsModal: React.FC<StandingsModalProps> = ({ visible, league, initialSeasonStartYear, onClose }) => {
    const [selectedSeasonStartYear, setSelectedSeasonStartYear] = useState<number>(
        () => initialSeasonStartYear ?? getCurrentSeasonStartYear()
    );
    const [uefaData, setUefaData] = useState<UefaJourneyPayload | null>(null);
    const [uefaLoading, setUefaLoading] = useState(false);
    const [uefaError, setUefaError] = useState(false);
    const [activeUefaTab, setActiveUefaTab] = useState<UefaTab>('path');
    const seasonOptions = useMemo(() => getRecentSeasonOptions(), []);

    useEffect(() => {
        if (visible) {
            setSelectedSeasonStartYear(initialSeasonStartYear ?? getCurrentSeasonStartYear());
        }
    }, [initialSeasonStartYear, visible]);

    useEffect(() => {
        if (!visible || league !== 'uefa') return;
        let cancelled = false;
        setUefaLoading(true);
        setUefaError(false);
        setUefaData(null);

        fetchUefaJourney(selectedSeasonStartYear).then((data) => {
            if (cancelled) return;
            setUefaData(data);
            setUefaError(!data);
            if (data?.participation?.state === 'league_phase' && data.standings) {
                setActiveUefaTab('standings');
            } else {
                setActiveUefaTab('path');
            }
            setUefaLoading(false);
        });

        return () => { cancelled = true; };
    }, [league, selectedSeasonStartYear, visible]);

    const isUefa = league === 'uefa';
    const competition = uefaData?.participation?.competition;
    const qualifier = uefaData?.participation?.qualifier;
    const modalTitle = isUefa
        ? competition?.name || 'Avrupa Yolculuğu'
        : 'Süper Lig Puan Durumu';
    const modalSubtitle = isUefa
        ? [competition ? null : qualifier?.qualifierName, uefaData?.participation.phaseLabel]
            .filter(Boolean)
            .join(' · ')
        : null;
    const uefaTabs = useMemo(() => {
        const tabs: Array<{ key: UefaTab; label: string }> = [
            { key: 'path', label: "Fener’in Yolu" },
        ];
        if (uefaData?.standings) tabs.push({ key: 'standings', label: 'Puan Durumu' });
        if (uefaData?.participation.competition) tabs.push({ key: 'bracket', label: 'Turnuva Ağacı' });
        return tabs;
    }, [uefaData]);

    if (!visible) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fadeIn ${isUefa ? 'p-0 sm:p-4' : 'p-4'}`}
            onClick={onClose}
        >
            <div
                className={`standings-dialog-surface relative flex w-full flex-col overflow-hidden border animate-slideUp ${isUefa
                    ? 'h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-7xl sm:rounded-2xl'
                    : 'max-h-[88vh] max-w-2xl rounded-2xl'
                }`}
                data-testid="standings-modal-surface"
                data-mobile-layout={isUefa ? 'fullscreen' : 'compact'}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
                <div className={`flex shrink-0 items-start justify-between gap-3 border-b border-white/10 ${isUefa
                    ? 'px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] sm:p-4'
                    : 'p-4'
                }`}>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{modalTitle}</p>
                        {modalSubtitle && (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">{modalSubtitle}</p>
                        )}
                        <SeasonSelector
                            value={selectedSeasonStartYear}
                            options={seasonOptions}
                            onChange={setSelectedSeasonStartYear}
                            minimal
                            className="mt-2"
                        />
                    </div>
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

                {isUefa && !uefaLoading && uefaData && (
                    <nav className="flex shrink-0 gap-5 overflow-x-auto border-b border-white/10 px-4" aria-label="Avrupa yolculuğu bölümleri">
                        {uefaTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveUefaTab(tab.key)}
                                className={`shrink-0 border-b-2 pb-3 pt-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 ${
                                    activeUefaTab === tab.key
                                        ? 'border-yellow-400 text-white'
                                        : 'border-transparent text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                )}

                <div className={`min-h-0 w-full flex-1 ${isUefa && activeUefaTab === 'bracket' ? 'overflow-hidden' : 'overflow-y-auto'} ${isUefa ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}>
                    {!isUefa && (
                        <CustomStandings league="superlig" seasonStartYear={selectedSeasonStartYear} />
                    )}
                    {isUefa && uefaLoading && (
                        <div className="flex h-64 items-center justify-center">
                            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-yellow-400" />
                        </div>
                    )}
                    {isUefa && !uefaLoading && uefaError && (
                        <EmptyState text="Avrupa verileri şu anda yüklenemedi. Biraz sonra tekrar deneyebilirsin." />
                    )}
                    {isUefa && !uefaLoading && uefaData?.participation.state === 'not_participating' && (
                        <EmptyState text="Bu sezonda Fenerbahçe’nin Avrupa maçı bulunamadı." />
                    )}
                    {isUefa && !uefaLoading && uefaData && uefaData.participation.state !== 'not_participating' && activeUefaTab === 'path' && (
                        <UefaPathView stages={uefaData.fenerPath} />
                    )}
                    {isUefa && !uefaLoading && uefaData && activeUefaTab === 'standings' && (
                        <CustomStandings
                            league="uefa"
                            seasonStartYear={selectedSeasonStartYear}
                            standingsData={uefaData.standings}
                        />
                    )}
                    {isUefa && !uefaLoading && uefaData && activeUefaTab === 'bracket' && (
                        <UefaBracketView bracket={uefaData.bracket} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default StandingsModal;
