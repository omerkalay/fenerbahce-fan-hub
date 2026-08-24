import { useMemo, useState } from 'react';
import LiveMatchTimeline from './LiveMatchTimeline';
import LiveMatchStats from './LiveMatchStats';
import MatchLineups from './MatchLineups';
import { isHalftimeDisplay } from '../utils/dashboardHelpers';
import { localizeTeamName } from '../utils/localize';
import { useTheme } from '../contexts/themeContextDef';
import { resolveTeamCrest } from '../theme/teamCrest';
import type { LiveMatchData } from '../types';

type MatchCenterSection = 'events' | 'stats' | 'lineups';

interface LiveMatchScoreProps {
    data: LiveMatchData;
    useSquadPhotos?: boolean;
}

const localizeStatusDetail = (statusDetail: string = ''): string => {
    const status = String(statusDetail || '').trim();
    const normalized = status.toLowerCase();

    if (normalized === 'ft' || normalized === 'full time' || normalized.includes('full time')) return 'Maç Sonu';
    if (normalized === 'ht' || normalized === 'halftime' || normalized.includes('half time')) return 'Devre Arası';
    if (normalized.includes('1st half') || normalized.includes('first half')) return '1. Yarı';
    if (normalized.includes('2nd half') || normalized.includes('second half')) return '2. Yarı';
    return status;
};

const TeamCrest = ({ src, name }: { src: string | null; name: string }) => (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.05] p-2 sm:h-[72px] sm:w-[72px]">
        {src ? (
            <img src={src} alt={`${name} logosu`} className="h-full w-full object-contain" />
        ) : (
            <span className="text-xs font-black text-slate-300">{name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
        )}
    </div>
);

export default function LiveMatchScore({ data: liveData, useSquadPhotos = true }: LiveMatchScoreProps) {
    const { theme } = useTheme();
    const [activeSection, setActiveSection] = useState<MatchCenterSection>('events');
    const isHalftime = isHalftimeDisplay(liveData.statusDetail, liveData.displayClock);
    const homeName = localizeTeamName(liveData.homeTeam?.name || 'Ev Sahibi');
    const awayName = localizeTeamName(liveData.awayTeam?.name || 'Deplasman');
    const homeTeamCrest = resolveTeamCrest({ theme, defaultSrc: liveData.homeTeam?.logo, teamName: homeName });
    const awayTeamCrest = resolveTeamCrest({ theme, defaultSrc: liveData.awayTeam?.logo, teamName: awayName });
    const isLive = liveData.matchState === 'in';
    const statusLabel = isLive
        ? 'Canlı'
        : localizeStatusDetail(liveData.statusDetail) || 'Maç Bitti';
    const clockLabel = isHalftime ? 'Devre Arası' : liveData.matchState === 'post' ? 'Maç Sonu' : liveData.displayClock || '';
    const tabs = useMemo<Array<{ id: MatchCenterSection; label: string }>>(() => [
        { id: 'events', label: 'Olaylar' },
        { id: 'stats', label: 'İstatistikler' },
        { id: 'lineups', label: 'Kadrolar' },
    ], []);

    return (
        <div className="w-full">
            <section className="live-match-score-card overflow-hidden rounded-2xl border border-white/10 bg-[#08172c]" aria-label="Canlı skor">
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                    <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Maç Merkezi</p>
                    <div className={`inline-flex shrink-0 items-center gap-2 py-1 text-[10px] font-black uppercase tracking-wider ${isLive ? 'text-yellow-300' : 'text-emerald-300'}`}>
                        {isLive && !isHalftime && <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 motion-safe:animate-pulse" aria-hidden="true" />}
                        {statusLabel}
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 px-4 py-5 sm:gap-5" aria-live="polite">
                    <div className="flex min-w-0 flex-col items-center text-center">
                        <TeamCrest src={homeTeamCrest} name={homeName} />
                        <p className="mt-2 line-clamp-2 max-w-28 break-words text-xs font-black leading-tight text-white sm:max-w-44 sm:text-sm">{homeName}</p>
                    </div>

                    <div className="min-w-[108px] pt-3 text-center sm:min-w-[150px]">
                        <p className="whitespace-nowrap text-[42px] font-black leading-none tracking-[-0.08em] text-white sm:text-5xl">
                            <span className="tabular-nums">{liveData.homeTeam?.score ?? '0'}</span>
                            <span className="px-2 text-2xl text-slate-600">–</span>
                            <span className="tabular-nums">{liveData.awayTeam?.score ?? '0'}</span>
                        </p>
                        <p className={`mt-2 text-sm font-black tabular-nums ${isLive ? 'text-yellow-300' : 'text-slate-400'}`}>{clockLabel}</p>
                    </div>

                    <div className="flex min-w-0 flex-col items-center text-center">
                        <TeamCrest src={awayTeamCrest} name={awayName} />
                        <p className="mt-2 line-clamp-2 max-w-28 break-words text-xs font-black leading-tight text-white sm:max-w-44 sm:text-sm">{awayName}</p>
                    </div>
                </div>

                <div className="live-match-tabs grid grid-cols-3 border-t border-white/[0.08] bg-slate-950/25" role="tablist" aria-label="Maç merkezi bölümleri">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeSection === tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            className={`min-h-12 border-b-2 px-2 text-xs font-black outline-none transition-colors focus-visible:bg-white/[0.07] ${activeSection === tab.id ? 'border-white/70 text-white' : 'border-transparent text-slate-500 hover:text-slate-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </section>

            <section className={activeSection === 'lineups' ? 'mt-4' : 'live-match-detail-card mt-4 rounded-2xl border border-white/10 bg-[#09182d] p-4 sm:p-5'}>
                {activeSection === 'events' && (
                    <div role="tabpanel">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-white">Maç Akışı</h3>
                        </div>
                        <LiveMatchTimeline
                            events={liveData.events}
                            homeTeamId={liveData.homeTeam?.id}
                            awayTeamId={liveData.awayTeam?.id}
                            homeTeamName={homeName}
                            awayTeamName={awayName}
                        />
                    </div>
                )}

                {activeSection === 'stats' && (
                    <div role="tabpanel">
                        <div className="mb-4">
                            <h3 className="text-sm font-black text-white">Karşılaştırma</h3>
                        </div>
                        <LiveMatchStats stats={liveData.stats} />
                    </div>
                )}

                {activeSection === 'lineups' && (
                    <div role="tabpanel">
                        {liveData.lineups ? (
                            <div className="space-y-3">
                                {(!liveData.lineups.home || !liveData.lineups.away) && (
                                    <p className="live-data-notice rounded-lg bg-sky-400/10 px-3 py-2 text-[10px] leading-relaxed text-sky-200">
                                        {!liveData.lineups.home ? homeName : awayName} İlk 11 verisi henüz gelmedi. Mevcut takım kadrosu gösteriliyor.
                                    </p>
                                )}
                                <MatchLineups
                                    lineups={liveData.lineups}
                                    homeTeamName={homeName}
                                    awayTeamName={awayName}
                                    matchId={liveData.matchId}
                                    useSquadPhotos={useSquadPhotos}
                                    embedded
                                />
                            </div>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-600/70 bg-slate-950/25 px-4 py-6 text-center">
                                <p className="text-xs font-bold text-slate-300">İlk 11 bilgisi henüz paylaşılmadı</p>
                                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Kadro verisi geldiğinde bu bölüm otomatik güncellenecek.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}
