import React, { useEffect, useMemo, useState } from 'react';
import { fetchEspnFenerbahceFixtures } from '../services/api';

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

function FixtureSchedule() {
    const [fixtureData, setFixtureData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [venueFilter, setVenueFilter] = useState('all');
    const [competitionFilter, setCompetitionFilter] = useState('all');

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
        return [...playedMatches, ...upcomingMatches];
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

    return (
        <div className="min-h-screen pb-24">
            <section className="mb-4 space-y-3">
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

                    {!error && filteredMatches.length > 0 && (
                        <div className="space-y-2.5">
                            {filteredMatches.map((match) => {
                                const dateInfo = formatMatchDate(match.date);
                                const scored = isScoredMatch(match);
                                const venueName = getDisplayVenueName(match);

                                return (
                                    <article
                                        key={match.id}
                                        className="glass-panel rounded-2xl p-4 border border-white/5 hover:border-yellow-400/10 transition-colors"
                                    >
                                        <p className="text-[12px] text-slate-400 mb-3">
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
                                                    <span className="font-bold text-slate-400 text-sm">VS</span>
                                                )}
                                            </div>

                                            <TeamInline
                                                team={match.awayTeam}
                                                isFenerbahce={match.awayTeam.id === match.fbTeam.id}
                                                align="right"
                                            />
                                        </div>

                                        {venueName && (
                                            <div className="mt-3 pt-3 border-t border-white/5">
                                                <p className="text-[11px] text-slate-500 truncate">
                                                    {venueName}
                                                </p>
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}

export default FixtureSchedule;
