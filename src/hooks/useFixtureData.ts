import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchEspnFenerbahceFixtures, fetchMatchSummary } from '../services/api';
import type { EspnFixtureMatch, EspnFixtureData, MatchSummaryData } from '../types';

// ─── Helpers (duplicated from FixtureSchedule for filtering) ─

const localizeTeamName = (name: string = ''): string => {
    if (!name) return name;

    return name
        .replace(/\bFenerbahce\b/gi, 'Fenerbahçe')
        .replace(/\bBesiktas\b/gi, 'Beşiktaş')
        .replace(/\bIstanbul Basaksehir\b/gi, 'İstanbul Başakşehir');
};

const getMatchTimestamp = (match: EspnFixtureMatch): number => {
    const value = new Date(match?.date).getTime();
    return Number.isFinite(value) ? value : 0;
};

// ─── Hook ────────────────────────────────────────────────

export function useFixtureData() {
    const [fixtureData, setFixtureData] = useState<EspnFixtureData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [activeSummaryMatch, setActiveSummaryMatch] = useState<EspnFixtureMatch | null>(null);
    const [activeSummaryData, setActiveSummaryData] = useState<MatchSummaryData | null>(null);
    const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);

    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [venueFilter, setVenueFilter] = useState<string>('all');
    const [competitionFilter, setCompetitionFilter] = useState<string>('all');
    const nextMatchFocusRef = useRef<HTMLElement | null>(null);

    // Lock body scroll while summary modal is open
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

    // Initial data load
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

    // ─── Derived / filtered data ─────────────────────────

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

    // ─── Summary modal ──────────────────────────────────

    const closeSummaryModal = () => {
        setActiveSummaryMatch(null);
        setActiveSummaryData(null);
        setSummaryLoading(false);
        setSummaryError(null);
    };

    const openSummaryModal = async (match: EspnFixtureMatch) => {
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

    return {
        // Core data / loading
        loading,
        error,
        isRefreshing,
        handleRefresh,

        // Filters
        statusFilter,
        setStatusFilter,
        showFilters,
        setShowFilters,
        searchTerm,
        setSearchTerm,
        venueFilter,
        setVenueFilter,
        competitionFilter,
        setCompetitionFilter,
        activeAdvancedFilterCount,
        clearAdvancedFilters,

        // Derived match lists
        filteredMatches,
        allFilterPlayedMatches,
        allFilterUpcomingMatches,
        allFilterNextMatch,
        allFilterLaterMatches,
        nextMatchFocusRef,

        // Summary modal
        activeSummaryMatch,
        activeSummaryData,
        summaryLoading,
        summaryError,
        summaryHomeLogo,
        summaryAwayLogo,
        openSummaryModal,
        closeSummaryModal,
    };
}
