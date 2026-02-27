import React, { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEspnFenerbahceFixtures, fetchMatchSummary } from '../services/api';
import MatchEventIcon, { getEventVisualType } from './MatchEventIcon';
import { formatMatchClock } from '../utils/matchClock';

const STATUS_FILTERS = [
    { id: 'all', label: 'Tümü' },
    { id: 'played', label: 'Biten' },
    { id: 'upcoming', label: 'Kalan' }
];

const VENUE_FILTERS = [
    { id: 'all', label: 'Tümü' },
    { id: 'home', label: 'İç Saha' },
    { id: 'away', label: 'Deplasman' }
];

const COMPETITION_FILTERS = [
    { id: 'all', label: 'Tümü' },
    { id: 'superlig', label: 'Süper Lig' },
    { id: 'europe', label: 'Avrupa' }
];

const localizeTeamName = (name = '') => {
    if (!name) return name;

    return name
        .replace(/\bFenerbahce\b/gi, 'Fenerbahçe')
        .replace(/\bBesiktas\b/gi, 'Beşiktaş')
        .replace(/\bIstanbul Basaksehir\b/gi, 'İstanbul Başakşehir');
};

const localizeSummaryStatus = (value = '') => {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) return 'Maç Sonucu';
    if (normalized === 'ft' || normalized === 'full time' || normalized.includes('full time')) return 'Maç Sonu';
    if (normalized === 'ht' || normalized === 'halftime' || normalized.includes('half time')) return 'Devre Arası';
    if (normalized === 'aet' || normalized.includes('after extra time')) return 'Uzatma Sonu';
    if (normalized.includes('penalties')) return 'Penaltılar Sonu';

    return value;
};

const getMatchTimestamp = (match) => {
    const value = new Date(match?.date).getTime();
    return Number.isFinite(value) ? value : 0;
};

const formatMatchDate = (date) => {
    const value = new Date(date);

    return {
        full: value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        time: value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };
};

const getDisplayVenueName = (match) => {
    const venueName = match?.venueName;
    if (!venueName) return null;

    if (
        match?.isFbHome &&
        /ulker|ülker|sukru|şükrü|saracoğlu|saracoglu/i.test(venueName)
    ) {
        return 'Chobani Stadyumu Şükrü Saracoğlu Spor Kompleksi';
    }

    return venueName;
};

const isScoredMatch = (match) => match.status.completed || match.status.state === 'in';

const TeamInline = ({ team, isFenerbahce = false, align = 'left' }) => (
    <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'justify-end text-right' : ''}`}>
        {align === 'right' && (
            <span className={`text-sm font-semibold truncate max-w-[120px] ${isFenerbahce ? 'text-yellow-300' : 'text-white'}`}>
                {localizeTeamName(team.shortName || team.name)}
            </span>
        )}

        <div className={`w-9 h-9 rounded-full overflow-hidden border flex items-center justify-center shrink-0 ${isFenerbahce ? 'border-yellow-400/40 bg-yellow-400/10' : 'border-white/10 bg-white/5'}`}>
            {team.logo ? (
                <img src={team.logo} alt={localizeTeamName(team.name)} className="w-full h-full object-contain p-1" loading="lazy" />
            ) : (
                <span className="text-[10px] font-bold text-slate-200">
                    {(team.abbreviation || localizeTeamName(team.name).slice(0, 2)).toUpperCase()}
                </span>
            )}
        </div>

        {align !== 'right' && (
            <span className={`text-sm font-semibold truncate max-w-[120px] ${isFenerbahce ? 'text-yellow-300' : 'text-white'}`}>
                {localizeTeamName(team.shortName || team.name)}
            </span>
        )}
    </div>
);

const FixtureMatchCard = ({ match, featured = false, cardRef = null, onOpenSummary = null }) => {
    const dateInfo = formatMatchDate(match.date);
    const scored = isScoredMatch(match);
    const isFinished = match.status.completed || match.status.state === 'post';
    const venueName = getDisplayVenueName(match);

    return (
        <article
            ref={cardRef}
            className={`glass-panel rounded-2xl p-4 border transition-colors ${featured
                ? 'border-yellow-400/20 shadow-[0_0_24px_rgba(234,179,8,0.08)]'
                : 'border-white/5 hover:border-yellow-400/10'
                }`}
        >
            <p className={`text-[12px] mb-3 ${featured ? 'text-slate-300' : 'text-slate-400'}`}>
                {dateInfo.full} • {dateInfo.time}
            </p>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <TeamInline
                    team={match.homeTeam}
                    isFenerbahce={match.homeTeam.id === match.fbTeam.id}
                    align="left"
                />

                <div className="px-2 text-center shrink-0">
                    {scored ? (
                        <span className="font-black text-white text-lg tracking-tight">
                            {match.homeTeam.score ?? '-'} <span className="text-slate-500">:</span> {match.awayTeam.score ?? '-'}
                        </span>
                    ) : (
                        <span className={`font-bold text-sm ${featured ? 'text-yellow-300' : 'text-slate-400'}`}>VS</span>
                    )}
                </div>

                <TeamInline
                    team={match.awayTeam}
                    isFenerbahce={match.awayTeam.id === match.fbTeam.id}
                    align="right"
                />
            </div>

            {(venueName || (isFinished && onOpenSummary)) && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-3">
                    <p className="text-[11px] text-slate-500 truncate min-w-0 flex-1">
                        {venueName || '\u00A0'}
                    </p>

                    {isFinished && onOpenSummary && (
                        <button
                            onClick={() => onOpenSummary(match)}
                            className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 hover:text-yellow-200 hover:border-yellow-400/35 hover:bg-yellow-400/10 transition-all duration-300 text-[11px] font-semibold whitespace-nowrap"
                        >
                            Maç İstatistikleri
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-yellow-300/90 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}
                </div>
            )}
        </article>
    );
};

function FixtureSchedule() {
    const [fixtureData, setFixtureData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeSummaryMatch, setActiveSummaryMatch] = useState(null);
    const [activeSummaryData, setActiveSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [venueFilter, setVenueFilter] = useState('all');
    const [competitionFilter, setCompetitionFilter] = useState('all');
    const nextMatchFocusRef = useRef(null);

    useEffect(() => {
        if (activeSummaryMatch) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [activeSummaryMatch]);

    useEffect(() => {
        let isMounted = true;

        const loadFixtures = async () => {
            setLoading(true);
            setError(null);

            const data = await fetchEspnFenerbahceFixtures();
            if (!isMounted) return;

            if (data?.error) {
                setError('Fikstür verisi alınamadı. Lütfen tekrar dene.');
            }

            setFixtureData(data);
            setLoading(false);
        };

        loadFixtures();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleRefresh = async () => {
        setError(null);
        setIsRefreshing(true);
        const data = await fetchEspnFenerbahceFixtures();
        if (data?.error) {
            setError('Fikstür verisi alınamadı. Lütfen tekrar dene.');
        }
        setFixtureData(data);
        setIsRefreshing(false);
    };

    const matches = useMemo(() => fixtureData?.matches ?? [], [fixtureData]);

    const playedMatches = useMemo(
        () => matches
            .filter((match) => match.status.completed || match.status.state === 'post')
            .sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a)),
        [matches]
    );

    const upcomingMatches = useMemo(
        () => matches
            .filter((match) => !match.status.completed && match.status.state !== 'post')
            .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b)),
        [matches]
    );

    const statusFilteredMatches = useMemo(() => {
        if (statusFilter === 'played') return playedMatches;
        if (statusFilter === 'upcoming') return upcomingMatches;
        return [...upcomingMatches, ...playedMatches];
    }, [statusFilter, playedMatches, upcomingMatches]);

    const normalizedQuery = searchTerm.trim().toLocaleLowerCase('tr-TR');

    const filteredMatches = useMemo(() => {
        return statusFilteredMatches.filter((match) => {
            if (venueFilter === 'home' && !match.isFbHome) return false;
            if (venueFilter === 'away' && match.isFbHome) return false;

            if (competitionFilter !== 'all' && match.competitionGroup !== competitionFilter) {
                return false;
            }

            if (normalizedQuery) {
                const haystack = [
                    localizeTeamName(match.homeTeam?.name || ''),
                    localizeTeamName(match.homeTeam?.shortName || ''),
                    localizeTeamName(match.awayTeam?.name || ''),
                    localizeTeamName(match.awayTeam?.shortName || ''),
                    localizeTeamName(match.opponentTeam?.name || '')
                ]
                    .join(' ')
                    .toLocaleLowerCase('tr-TR');

                if (!haystack.includes(normalizedQuery)) {
                    return false;
                }
            }

            return true;
        });
    }, [statusFilteredMatches, venueFilter, competitionFilter, normalizedQuery]);

    const allFilterPlayedMatches = useMemo(() => {
        if (statusFilter !== 'all') return [];
        return filteredMatches
            .filter((match) => match.status.completed || match.status.state === 'post')
            .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
    }, [statusFilter, filteredMatches]);

    const allFilterUpcomingMatches = useMemo(() => {
        if (statusFilter !== 'all') return [];
        return filteredMatches
            .filter((match) => !match.status.completed && match.status.state !== 'post')
            .sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
    }, [statusFilter, filteredMatches]);

    const allFilterNextMatch = allFilterUpcomingMatches[0] ?? null;
    const allFilterLaterMatches = allFilterUpcomingMatches.slice(1);

    const activeAdvancedFilterCount = [
        venueFilter !== 'all',
        competitionFilter !== 'all',
        normalizedQuery.length > 0
    ].filter(Boolean).length;

    const clearAdvancedFilters = () => {
        setSearchTerm('');
        setVenueFilter('all');
        setCompetitionFilter('all');
    };

    const closeSummaryModal = () => {
        setActiveSummaryMatch(null);
        setActiveSummaryData(null);
        setSummaryLoading(false);
        setSummaryError(null);
    };

    const openSummaryModal = async (match) => {
        setActiveSummaryMatch(match);
        setActiveSummaryData(null);
        setSummaryError(null);
        setSummaryLoading(true);

        const summary = await fetchMatchSummary(match.id);
        if (summary) {
            setActiveSummaryData(summary);
        } else {
            setSummaryError('Bu maç için istatistik özeti henüz hazır değil.');
        }

        setSummaryLoading(false);
    };

    const summaryHomeLogo = activeSummaryData?.homeTeam?.logo || activeSummaryMatch?.homeTeam?.logo || null;
    const summaryAwayLogo = activeSummaryData?.awayTeam?.logo || activeSummaryMatch?.awayTeam?.logo || null;

    return (
        <div className="min-h-screen pb-24">
            <section className="sticky top-0 z-30 mb-4 space-y-3 pt-1 pb-2 bg-gradient-to-b from-slate-950/95 via-slate-950/90 to-transparent backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                    <div className="grid grid-cols-3 gap-2 flex-1">
                        {STATUS_FILTERS.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setStatusFilter(item.id)}
                                className={`px-2 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${statusFilter === item.id
                                    ? 'bg-yellow-400 text-black shadow-[0_0_18px_rgba(234,179,8,0.25)]'
                                    : 'glass-panel text-slate-300 hover:bg-white/10'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                        <button
                            onClick={() => setShowFilters((prev) => !prev)}
                            className={`h-[38px] px-[11px] rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${showFilters
                                ? 'border-yellow-400/30 text-yellow-300 bg-yellow-400/5'
                                : 'border-white/10 text-slate-300 bg-white/5 hover:bg-white/10'
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12m-9 8h6" />
                            </svg>
                            <span>Filtre</span>
                            {activeAdvancedFilterCount > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-yellow-400 text-black text-[9px] inline-flex items-center justify-center font-bold">
                                    {activeAdvancedFilterCount}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={handleRefresh}
                            disabled={loading || isRefreshing}
                            className="h-[38px] px-[11px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
                            title="Fikstürü yenile"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`w-4 h-4 text-yellow-300 ${isRefreshing ? 'animate-spin' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M20 9a8 8 0 00-13.66-3.66L4 7m16 10l-2.34 2.34A8 8 0 014 15" />
                            </svg>
                            <span>{isRefreshing ? 'Yenileniyor' : 'Yenile'}</span>
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="glass-panel rounded-2xl p-3 space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/5">
                            <div className="flex items-center gap-2 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 12h12m-9 8h6" />
                                </svg>
                                <p className="text-xs font-semibold text-white">Maç Filtreleri</p>
                            </div>
                            <button
                                onClick={() => setShowFilters(false)}
                                className="text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300 shrink-0"
                                aria-label="Filtre panelini kapat"
                                title="Kapat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div>
                            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Takım Ara</label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Rakip adı yaz..."
                                className="w-full rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-yellow-400/30"
                            />
                        </div>

                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Saha</p>
                            <div className="flex flex-wrap gap-2">
                                {VENUE_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setVenueFilter(item.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${venueFilter === item.id
                                            ? 'bg-yellow-400/10 text-yellow-200 border border-yellow-400/25'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1.5">Kulvar</p>
                            <div className="flex flex-wrap gap-2">
                                {COMPETITION_FILTERS.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setCompetitionFilter(item.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${competitionFilter === item.id
                                            ? 'bg-blue-400/10 text-blue-200 border border-blue-400/25'
                                            : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 pt-1">
                            <p className="text-xs text-slate-400">
                                {filteredMatches.length} maç gösteriliyor
                            </p>
                            <button
                                onClick={clearAdvancedFilters}
                                className="text-sm font-semibold text-slate-200 hover:text-white transition-colors"
                            >
                                Temizle
                            </button>
                        </div>
                    </div>
                )}
            </section>

            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="glass-panel rounded-2xl p-4 animate-pulse">
                            <div className="h-4 w-36 bg-white/10 rounded mb-3" />
                            <div className="h-10 w-full bg-white/5 rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : (
                <section className="space-y-3">
                    {error && (
                        <div className="glass-panel rounded-2xl p-4 border border-rose-400/20">
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}

                    {!error && filteredMatches.length === 0 && (
                        <div className="glass-panel rounded-2xl p-5 text-center">
                            <p className="text-sm text-slate-300">Bu filtre için maç bulunamadı.</p>
                        </div>
                    )}

                    {!error && filteredMatches.length > 0 && statusFilter !== 'all' && (
                        <div className="space-y-2.5">
                            {filteredMatches.map((match) => (
                                <FixtureMatchCard key={match.id} match={match} onOpenSummary={openSummaryModal} />
                            ))}
                        </div>
                    )}

                    {!error && filteredMatches.length > 0 && statusFilter === 'all' && (
                        <div className="relative space-y-4">
                            {allFilterPlayedMatches.length > 0 && (
                                <section className="space-y-2.5">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-px bg-white/10 flex-1" />
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Geçmiş</p>
                                        <div className="h-px bg-white/10 flex-1" />
                                    </div>
                                    {allFilterPlayedMatches.map((match) => (
                                        <FixtureMatchCard key={match.id} match={match} onOpenSummary={openSummaryModal} />
                                    ))}
                                </section>
                            )}

                            {allFilterNextMatch && (
                                <section className="space-y-2.5">
                                    {allFilterPlayedMatches.length > 0 && (
                                        <div className="flex justify-center">
                                            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/65 backdrop-blur-sm">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                </svg>
                                                <span>Geçmiş</span>
                                                <span className="text-white/30">•</span>
                                                <span>Kaydır</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-px bg-yellow-400/20 flex-1" />
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-yellow-300">Sıradaki Maç</p>
                                        <div className="h-px bg-yellow-400/20 flex-1" />
                                    </div>
                                    <FixtureMatchCard match={allFilterNextMatch} featured cardRef={nextMatchFocusRef} onOpenSummary={openSummaryModal} />

                                    {allFilterLaterMatches.length > 0 && (
                                        <div className="flex justify-center">
                                            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/65 backdrop-blur-sm">
                                                <span>Kaydır</span>
                                                <span className="text-white/30">•</span>
                                                <span>Gelecek</span>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            )}

                            {allFilterLaterMatches.length > 0 && (
                                <section className="space-y-2.5">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="h-px bg-white/10 flex-1" />
                                        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Gelecek</p>
                                        <div className="h-px bg-white/10 flex-1" />
                                    </div>
                                    {allFilterLaterMatches.map((match) => (
                                        <FixtureMatchCard key={match.id} match={match} onOpenSummary={openSummaryModal} />
                                    ))}
                                </section>
                            )}

                        </div>
                    )}
                </section>
            )}

            {activeSummaryMatch && (
                <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4">
                    <button
                        onClick={closeSummaryModal}
                        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
                        aria-label="Kapat"
                    />

                    <div className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden glass-card rounded-2xl border border-yellow-400/20">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-yellow-300">Maç İstatistikleri</p>
                                <p className="text-[11px] text-slate-400">
                                    {localizeTeamName(activeSummaryMatch.homeTeam?.name)} vs {localizeTeamName(activeSummaryMatch.awayTeam?.name)}
                                </p>
                            </div>
                            <button
                                onClick={closeSummaryModal}
                                className="p-1 text-slate-400 hover:text-white hover:rotate-90 transition-all duration-300"
                                aria-label="Kapat"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[calc(88vh-72px)] space-y-4">
                            {summaryLoading && (
                                <div className="space-y-3 animate-pulse">
                                    <div className="h-20 rounded-xl bg-white/5" />
                                    <div className="h-28 rounded-xl bg-white/5" />
                                    <div className="h-28 rounded-xl bg-white/5" />
                                </div>
                            )}

                            {!summaryLoading && summaryError && (
                                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                                    {summaryError}
                                </div>
                            )}

                            {!summaryLoading && !summaryError && activeSummaryData && (
                                <>
                                    <div className="glass-panel rounded-xl p-4">
                                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                                    {summaryHomeLogo ? (
                                                        <img src={summaryHomeLogo} alt={localizeTeamName(activeSummaryData.homeTeam?.name || '')} className="w-full h-full object-contain p-1" loading="lazy" />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold">
                                                            {localizeTeamName(activeSummaryData.homeTeam?.name || '').slice(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-base font-bold text-white text-left truncate">{localizeTeamName(activeSummaryData.homeTeam?.name || '')}</p>
                                            </div>
                                            <p className="text-3xl font-black text-white px-4">
                                                {activeSummaryData.homeTeam?.score ?? '0'} <span className="text-slate-500">-</span> {activeSummaryData.awayTeam?.score ?? '0'}
                                            </p>
                                            <div className="flex items-center justify-end gap-2.5 min-w-0">
                                                <p className="text-base font-bold text-white text-right truncate">{localizeTeamName(activeSummaryData.awayTeam?.name || '')}</p>
                                                <div className="w-11 h-11 rounded-full overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                                    {summaryAwayLogo ? (
                                                        <img src={summaryAwayLogo} alt={localizeTeamName(activeSummaryData.awayTeam?.name || '')} className="w-full h-full object-contain p-1" loading="lazy" />
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 font-bold">
                                                            {localizeTeamName(activeSummaryData.awayTeam?.name || '').slice(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-2 text-center">
                                            {localizeSummaryStatus(activeSummaryData.statusDetail)}
                                        </p>
                                    </div>

                                    {Array.isArray(activeSummaryData.stats) && activeSummaryData.stats.length > 0 && (
                                        <div className="glass-panel rounded-xl p-4">
                                            <h4 className="text-sm font-bold text-white mb-3">Özet İstatistikler</h4>
                                            <div className="space-y-3">
                                                {activeSummaryData.stats.map((stat, index) => {
                                                    const homeVal = Number.parseFloat(String(stat.homeValue).replace(',', '.')) || 0;
                                                    const awayVal = Number.parseFloat(String(stat.awayValue).replace(',', '.')) || 0;
                                                    const total = homeVal + awayVal || 1;

                                                    return (
                                                        <div key={`${stat.key}-${index}`} className="space-y-1">
                                                            <div className="flex justify-between text-xs text-slate-300">
                                                                <span className="font-semibold text-white">{stat.homeValue}</span>
                                                                <span>{stat.label}</span>
                                                                <span className="font-semibold text-white">{stat.awayValue}</span>
                                                            </div>
                                                            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex">
                                                                <div className="h-full bg-yellow-400" style={{ width: `${(homeVal / total) * 100}%` }} />
                                                                <div className="h-full flex-1 bg-slate-600" />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {Array.isArray(activeSummaryData.events) && activeSummaryData.events.length > 0 && (
                                        <div className="glass-panel rounded-xl p-4">
                                            <h4 className="text-sm font-bold text-white mb-3">Maç Olayları</h4>
                                            <div className="space-y-2">
                                                {activeSummaryData.events.map((event, index) => {
                                                    const eventType = getEventVisualType(event);
                                                    const rowClass = eventType === 'goal'
                                                        ? 'bg-yellow-400/10'
                                                        : eventType === 'red-card'
                                                            ? 'bg-red-500/10'
                                                            : 'bg-white/5';
                                                    const textClass = eventType === 'goal'
                                                        ? 'text-yellow-300 font-semibold'
                                                        : eventType === 'red-card'
                                                            ? 'text-red-300'
                                                            : 'text-slate-200';

                                                    return (
                                                        <div key={`${event.clock}-${index}`} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${rowClass}`}>
                                                            <span className="text-[11px] text-yellow-300 w-12">{formatMatchClock(event.clock)}</span>
                                                            <span className="w-4 h-4 flex items-center justify-center">
                                                                <MatchEventIcon event={event} className={eventType === 'goal' ? 'w-4 h-4' : 'w-3 h-4'} />
                                                            </span>
                                                            <span className={`text-sm ${textClass}`}>
                                                                {event.player || event.type || 'Olay'}
                                                                {event.isGoal && event.isPenalty && (
                                                                    <span className="ml-1 text-yellow-200 font-semibold">(P)</span>
                                                                )}
                                                                {event.isGoal && event.assist && (
                                                                    <span className="ml-2 text-slate-300/85 font-medium">Asist: {event.assist}</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FixtureSchedule;
