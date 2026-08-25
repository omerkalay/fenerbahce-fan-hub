import { useEffect, useMemo, useState } from 'react';
import { fetchFormResults, fetchPlayerStats, subscribePlayerStatus } from '../services/api';
import type { FormResult, PlayerStat, PlayerStatusEntry } from '../types';
import FormChart from './statistics/FormChart';
import PlayerRankingSection from './statistics/PlayerRankingSection';
import SkeletonCard from './statistics/SkeletonCard';
import PlayerStatusSection from './statistics/PlayerStatusSection';
import SeasonSelector from './SeasonSelector';
import { getCurrentSeasonStartYear, getRecentSeasonOptions } from '../utils/seasons';

const Statistics: React.FC = () => {
    const [selectedSeasonStartYear, setSelectedSeasonStartYear] = useState<number>(() => getCurrentSeasonStartYear());
    const seasonOptions = useMemo(() => getRecentSeasonOptions(), []);

    const [scorers, setScorers] = useState<PlayerStat[]>([]);
    const [scorersLoading, setScorersLoading] = useState(true);
    const [scorersError, setScorersError] = useState<string | null>(null);

    const [assisters, setAssisters] = useState<PlayerStat[]>([]);
    const [assistersLoading, setAssistersLoading] = useState(true);
    const [assistersError, setAssistersError] = useState<string | null>(null);

    const [form, setForm] = useState<FormResult[]>([]);
    const [formLoading, setFormLoading] = useState(true);
    const [formError, setFormError] = useState<string | null>(null);

    const [playerStatus, setPlayerStatus] = useState<PlayerStatusEntry[]>([]);
    const [statusLoading, setStatusLoading] = useState(true);
    const [statusError, setStatusError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setScorersLoading(true);
            setAssistersLoading(true);
            setScorersError(null);
            setAssistersError(null);
            setScorers([]);
            setAssisters([]);

            try {
                const stats = await fetchPlayerStats(selectedSeasonStartYear);
                if (cancelled) return;
                setScorers(stats);
                setAssisters(stats);
            } catch {
                if (!cancelled) {
                    setScorersError('Gol krallığı verileri yüklenemedi.');
                    setAssistersError('Asist krallığı verileri yüklenemedi.');
                }
            } finally {
                if (!cancelled) {
                    setScorersLoading(false);
                    setAssistersLoading(false);
                }
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, [selectedSeasonStartYear]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const results = await fetchFormResults();
                if (cancelled) return;
                setFormError(null);
                setForm(results);
            } catch {
                if (!cancelled) setFormError('Form verileri yüklenemedi.');
            } finally {
                if (!cancelled) setFormLoading(false);
            }
        };
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const unsubscribe = subscribePlayerStatus(
            (entries) => {
                setPlayerStatus(entries);
                setStatusError(null);
                setStatusLoading(false);
            },
            () => {
                setStatusError('Sakatlık verileri yüklenemedi.');
                setStatusLoading(false);
            }
        );
        return unsubscribe;
    }, []);

    return (
        <div className="min-h-screen pb-24 space-y-4">
            <div className="flex items-center justify-between gap-3 px-1 pb-0.5">
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">Gol ve Asist Krallığı sezonu</p>
                    <p className="text-[11px] text-slate-500">İki sıralama da birlikte güncellenir.</p>
                </div>
                <SeasonSelector
                    value={selectedSeasonStartYear}
                    options={seasonOptions}
                    onChange={setSelectedSeasonStartYear}
                    minimal
                    className="shrink-0"
                />
            </div>

            <PlayerRankingSection
                title="Gol Krallığı"
                players={scorers}
                loading={scorersLoading}
                error={scorersError}
                metric="goals"
                emptyMessage="Gol istatistiği henüz mevcut değil."
                emptyTabMessage="Bu kategoride gol verisi bulunmuyor."
            />

            <PlayerRankingSection
                title="Asist Krallığı"
                players={assisters}
                loading={assistersLoading}
                error={assistersError}
                metric="assists"
                emptyMessage="Asist istatistiği henüz mevcut değil."
                emptyTabMessage="Bu kategoride asist verisi bulunmuyor."
            />

            {formLoading ? (
                <SkeletonCard lines={2} />
            ) : (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-white mb-3">Son Form</h3>
                    {formError ? (
                        <p className="text-xs text-rose-300">{formError}</p>
                    ) : form.length === 0 ? (
                        <p className="text-xs text-slate-400">Form verisi henüz mevcut değil.</p>
                    ) : (
                        <FormChart matches={form} />
                    )}
                </section>
            )}

            {statusLoading ? (
                <SkeletonCard lines={3} />
            ) : statusError ? (
                <section className="glass-panel rounded-2xl p-4">
                    <h3 className="text-[15px] font-bold text-white mb-3">Sakatlık ve Ceza Durumu</h3>
                    <p className="text-xs text-rose-300">{statusError}</p>
                </section>
            ) : <PlayerStatusSection entries={playerStatus} />}
        </div>
    );
};

export default Statistics;
