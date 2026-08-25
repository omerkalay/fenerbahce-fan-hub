import type { PlayerStatusEntry } from '../../types';

interface PlayerStatusSectionProps {
    entries: PlayerStatusEntry[];
    showEmpty?: boolean;
    preview?: boolean;
}

const STATUS_META: Record<PlayerStatusEntry['status'], { label: string; text: string }> = {
    injured: { label: 'Sakat', text: 'text-red-400' },
    suspended: { label: 'Cezalı', text: 'text-yellow-400' },
    doubtful: { label: 'Belirsiz', text: 'text-orange-400' },
    'card-risk': { label: 'Sınırda', text: 'text-amber-400' },
    fit: { label: 'Uygun', text: 'text-emerald-400' }
};

const formatPlayerStatusRelativeTime = (timestamp: number): string => {
    const elapsed = Math.max(0, Date.now() - timestamp);
    const hoursAgo = Math.floor(elapsed / (1000 * 60 * 60));
    if (hoursAgo < 1) return 'Az önce';
    if (hoursAgo < 24) return `${hoursAgo} saat önce`;
    return `${Math.floor(hoursAgo / 24)} gün önce`;
};

const StatusRows = ({ entries }: { entries: PlayerStatusEntry[] }) => (
    <div className="space-y-0">
        {entries.map((entry, index) => {
            const badge = STATUS_META[entry.status];
            return (
                <div key={`${entry.playerId || entry.name}-${index}`} className="flex items-center gap-3 border-b border-white/5 py-2.5 last:border-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="truncate text-sm font-semibold text-white">{entry.name}</span>
                            {entry.detail && <span className="text-[13px] text-slate-400">{entry.detail}</span>}
                        </div>
                        {entry.returnDate && (entry.status === 'injured' || entry.status === 'doubtful') && (
                            <span className="mt-0.5 block text-[13px] text-slate-500">Tahmini dönüş: {entry.returnDate}</span>
                        )}
                    </div>
                    <span className={`shrink-0 text-[13px] font-semibold uppercase tracking-wider opacity-70 ${badge.text}`}>
                        {badge.label}
                    </span>
                </div>
            );
        })}
    </div>
);

const PlayerStatusSection = ({ entries, showEmpty = false, preview = false }: PlayerStatusSectionProps) => {
    const activeEntries = entries.filter((entry) => entry.status !== 'fit');
    const latestUpdatedAt = entries.reduce((latest, entry) => Math.max(latest, entry.updatedAt || 0), 0);
    const groups = [
        { key: 'injured', title: 'Sakatlar' },
        { key: 'suspended', title: 'Cezalılar' },
        { key: 'doubtful', title: 'Belirsiz' }
    ] as const;
    const visibleGroups = groups
        .map((group) => ({ ...group, entries: activeEntries.filter((entry) => entry.status === group.key) }))
        .filter((group) => group.entries.length > 0);
    const cardRiskEntries = activeEntries.filter((entry) => entry.status === 'card-risk');

    if (activeEntries.length === 0) {
        if (!showEmpty) return null;
        return (
            <section className={`${preview ? 'rounded-xl border border-white/10 bg-white/[0.03]' : 'glass-panel rounded-2xl'} p-4`}>
                <h3 className="mb-2 text-[15px] font-bold text-white">Sakatlık ve Ceza Durumu</h3>
                <p className="text-xs text-slate-400">Yayınlanacak aktif oyuncu durumu yok.</p>
            </section>
        );
    }

    return (
        <div className="space-y-4">
            {visibleGroups.length > 0 && (
                <section className={`${preview ? 'rounded-xl border border-white/10 bg-white/[0.03]' : 'glass-panel rounded-2xl'} p-4`}>
                    <h3 className="mb-3 text-[15px] font-bold text-white">Sakatlık ve Ceza Durumu</h3>
                    {visibleGroups.map((group, index) => (
                        <div key={group.key} className={index > 0 ? 'mt-3' : ''}>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</h4>
                            <StatusRows entries={group.entries} />
                        </div>
                    ))}
                    {latestUpdatedAt > 0 && (
                        <p className="mt-3 text-right text-[13px] text-slate-500">Son güncelleme: {formatPlayerStatusRelativeTime(latestUpdatedAt)}</p>
                    )}
                </section>
            )}

            {cardRiskEntries.length > 0 && (
                <section className={`${preview ? 'rounded-xl border border-white/10 bg-white/[0.03]' : 'glass-panel rounded-2xl'} p-4`}>
                    <h3 className="mb-3 text-[15px] font-bold text-white">Kart Sınırındakiler</h3>
                    <StatusRows entries={cardRiskEntries} />
                    {latestUpdatedAt > 0 && (
                        <p className="mt-3 text-right text-[13px] text-slate-500">Son güncelleme: {formatPlayerStatusRelativeTime(latestUpdatedAt)}</p>
                    )}
                </section>
            )}
        </div>
    );
};

export default PlayerStatusSection;
