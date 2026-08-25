import MatchLineups from './MatchLineups';
import type { PublishedMatchLineups } from '../types';

interface StartingXIModalProps {
    visible: boolean;
    data: PublishedMatchLineups;
    onClose: () => void;
    isSimulation?: boolean;
    useSquadPhotos?: boolean;
}

const StartingXIModal = ({
    visible,
    data,
    onClose,
    isSimulation = false,
    useSquadPhotos = true,
}: StartingXIModalProps) => {
    if (!visible) return null;
    const availableSides = (['home', 'away'] as const).filter((side) => Boolean(data.lineups[side]));
    const singleManualLineup = availableSides.length === 1 && data.sources?.[availableSides[0]] === 'manual';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 animate-slideUp"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-white/10 p-4">
                    <div>
                        <p className="text-base font-black text-white">
                            {isSimulation ? 'Simülasyon İlk 11’i' : singleManualLineup ? 'Fenerbahçe İlk 11’i' : 'İlk 11’ler Açıklandı'}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                            {isSimulation
                                ? 'Kaynak: Yerel geliştirme verisi'
                                : `Kaynak: ${singleManualLineup ? 'Yönetim paneli' : data.sources?.home === 'manual' || data.sources?.away === 'manual' ? 'Yönetim paneli / ESPN' : 'ESPN'}`}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Kapat">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <MatchLineups
                        lineups={data.lineups}
                        homeTeamName={data.homeTeam.name}
                        awayTeamName={data.awayTeam.name}
                        matchId={data.matchId}
                        useSquadPhotos={useSquadPhotos}
                        embedded
                    />
                </div>
            </div>
        </div>
    );
};

export default StartingXIModal;
