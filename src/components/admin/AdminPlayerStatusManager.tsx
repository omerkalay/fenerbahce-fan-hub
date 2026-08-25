import { useEffect, useMemo, useState } from 'react';
import type { Player } from '../../types';
import type {
    AdminPlayerStatus,
    AdminPlayerStatusEntry,
    AdminPlayerStatusState
} from '../../services/admin';
import PlayerStatusSection from '../statistics/PlayerStatusSection';

interface AdminPlayerStatusManagerProps {
    state: AdminPlayerStatusState | null;
    squad: Player[];
    busy: boolean;
    onSave: (entries: AdminPlayerStatusEntry[]) => Promise<void>;
    onPublish: (entries: AdminPlayerStatusEntry[]) => Promise<void>;
}

const STATUS_OPTIONS: Array<{ value: AdminPlayerStatus; label: string }> = [
    { value: 'injured', label: 'Sakat' },
    { value: 'suspended', label: 'Cezalı' },
    { value: 'doubtful', label: 'Belirsiz' },
    { value: 'card-risk', label: 'Kart sınırında' }
];

const DESCRIPTION_PRESETS: Record<AdminPlayerStatus, string[]> = {
    injured: [
        'Kas sakatlığı',
        'Diz sakatlığı',
        'Ayak bileği sakatlığı',
        'Hastalık',
        'Düşük kondisyon',
        'Sakatlığı belirsiz'
    ],
    suspended: [
        '1 maç ceza',
        '2 maç ceza',
        '3 maç ceza',
        'Kırmızı kart cezası',
        'Kart cezası',
        'Disiplin cezası'
    ],
    doubtful: [
        'Hastalık',
        'Düşük kondisyon',
        'Durumu belirsiz',
        'Maç saati belli olacak',
        'Tedavisi sürüyor',
        'Takımla çalışmalara başladı'
    ],
    'card-risk': ['3 sarı kart', '7 sarı kart', '11 sarı kart']
};

const RETURN_DATE_PRESETS = [
    'Belirsiz',
    'Maç saati',
    '1 hafta',
    '2 hafta',
    '3-4 hafta',
    '1 ay',
    'Milli ara sonrası',
    'Sezonu kapattı'
];
const SESSION_STARTED_AT = Date.now();

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ');

const hydrateEntries = (entries: AdminPlayerStatusEntry[], squad: Player[]): AdminPlayerStatusEntry[] => {
    const squadByName = new Map(squad.map((player) => [normalizeName(player.name), player]));
    return entries.map((entry) => {
        const matchingPlayer = squadByName.get(normalizeName(entry.name));
        if (!matchingPlayer || (entry.source === 'manual' && !entry.playerId.startsWith('legacy-'))) return entry;
        return {
            ...entry,
            playerId: String(matchingPlayer.id),
            source: 'squad',
            name: matchingPlayer.name
        };
    });
};

const createSquadEntry = (player: Player): AdminPlayerStatusEntry => ({
    playerId: String(player.id),
    source: 'squad',
    name: player.name,
    status: 'injured',
    detail: '',
    returnDate: ''
});

const createManualEntry = (): AdminPlayerStatusEntry => ({
    playerId: '',
    source: 'manual',
    name: '',
    status: 'injured',
    detail: '',
    returnDate: ''
});

const PlayerAvatar = ({ player, name }: { player?: Player; name: string }) => (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-slate-800 text-sm font-black text-slate-300">
        {player?.photo
            ? <img src={player.photo} alt="" className="h-full w-full object-cover" />
            : <span>{name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?'}</span>}
    </div>
);

const AdminPlayerStatusManager = ({
    state,
    squad,
    busy,
    onSave,
    onPublish
}: AdminPlayerStatusManagerProps) => {
    const sourceEntries = useMemo(
        () => hydrateEntries(state?.draft?.entries || state?.published || [], squad),
        [squad, state]
    );
    const [entries, setEntries] = useState<AdminPlayerStatusEntry[]>(sourceEntries);
    const [search, setSearch] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editor, setEditor] = useState<AdminPlayerStatusEntry | null>(null);

    useEffect(() => {
        setEntries(sourceEntries);
    }, [sourceEntries]);

    const squadById = useMemo(() => new Map(squad.map((player) => [String(player.id), player])), [squad]);
    const selectedIds = useMemo(() => new Set(entries.filter((entry) => entry.source === 'squad').map((entry) => entry.playerId)), [entries]);
    const filteredSquad = useMemo(() => {
        const query = normalizeName(search);
        return squad.filter((player) => !selectedIds.has(String(player.id)) && (!query || normalizeName(player.name).includes(query)));
    }, [search, selectedIds, squad]);
    const serializedEntries = JSON.stringify(entries.map(({ updatedAt: _updatedAt, ...entry }) => entry));
    const serializedSource = JSON.stringify(sourceEntries.map(({ updatedAt: _updatedAt, ...entry }) => entry));
    const dirty = serializedEntries !== serializedSource;
    const latestPublishedAt = state?.lastPublishedAt
        || state?.published.reduce((latest, entry) => Math.max(latest, entry.updatedAt || 0), 0)
        || 0;
    const stale = latestPublishedAt > 0 && SESSION_STARTED_AT - latestPublishedAt > 14 * 24 * 60 * 60 * 1000;

    const openEditor = (entry: AdminPlayerStatusEntry, index: number | null) => {
        setEditingIndex(index);
        setEditor({ ...entry });
        setPickerOpen(false);
    };

    const saveEditor = () => {
        if (!editor) return;
        const normalized = {
            ...editor,
            name: editor.name.trim().replace(/\s+/g, ' '),
            detail: editor.detail.trim(),
            returnDate: editor.status === 'injured' || editor.status === 'doubtful' ? editor.returnDate.trim() : ''
        };
        if (normalized.name.length < 2) return;
        const duplicate = entries.some((entry, index) => (
            index !== editingIndex
            && (normalizeName(entry.name) === normalizeName(normalized.name)
                || (normalized.playerId && entry.source === normalized.source && entry.playerId === normalized.playerId))
        ));
        if (duplicate) return;
        setEntries((current) => editingIndex === null
            ? [...current, normalized]
            : current.map((entry, index) => index === editingIndex ? normalized : entry));
        setEditor(null);
        setEditingIndex(null);
    };

    const previewEntries = entries.map((entry) => ({ ...entry, updatedAt: entry.updatedAt || latestPublishedAt }));

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            {stale && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-100">
                    Canlı oyuncu durumları 14 günden eski. Yayınlamadan önce kayıtları kontrol et.
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-white">Oyuncu durumları</p>
                    <p className="text-xs text-slate-400">Taslak: {entries.length}/40 oyuncu{dirty ? ' · kaydedilmemiş değişiklik' : ''}</p>
                </div>
                <button
                    type="button"
                    disabled={busy || entries.length >= 40}
                    onClick={() => { setSearch(''); setPickerOpen(true); }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-2xl font-light text-slate-950 disabled:opacity-40"
                    aria-label="Oyuncu durumu ekle"
                >+</button>
            </div>

            {entries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-xs text-slate-400">
                    Taslakta oyuncu yok. Kadrodan eklemek için + düğmesini kullan.
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry, index) => {
                        const player = entry.source === 'squad' ? squadById.get(entry.playerId) : undefined;
                        return (
                            <div key={`${entry.source}-${entry.playerId || entry.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                <PlayerAvatar player={player} name={entry.name} />
                                <button type="button" onClick={() => openEditor(entry, index)} className="min-w-0 flex-1 text-left">
                                    <p className="truncate text-sm font-bold text-white">{entry.name}</p>
                                    <p className="mt-0.5 truncate text-xs text-slate-400">
                                        {STATUS_OPTIONS.find((option) => option.value === entry.status)?.label}{entry.detail ? ` · ${entry.detail}` : ''}
                                    </p>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                                    className="rounded-lg px-2 py-1 text-xs font-bold text-red-300 hover:bg-red-500/10"
                                    aria-label={`${entry.name} durumunu taslaktan çıkar`}
                                >Sil</button>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void onSave(entries)}
                    className="rounded-xl bg-white/10 px-3 py-3 text-xs font-bold text-white disabled:opacity-40"
                >Taslağı kaydet</button>
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onPublish(entries)}
                    className="rounded-xl bg-yellow-400 px-3 py-3 text-xs font-black text-slate-950 disabled:opacity-40"
                >Yayınla</button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
                Silme işlemi yalnızca bu taslaktan çıkarır. “Yayınla” mevcut canlı listeyi bu önizlemeyle değiştirir ve otomatik bildirim göndermez.
            </p>

            <div className="border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Yayın öncesi önizleme</p>
                <PlayerStatusSection entries={previewEntries} showEmpty preview />
            </div>

            {pickerOpen && (
                <div className="fixed inset-0 z-[150] flex items-end bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Oyuncu seç">
                    <div className="max-h-[82vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="text-base font-black text-white">Oyuncu seç</p>
                            <button type="button" onClick={() => setPickerOpen(false)} className="p-2 text-white" aria-label="Oyuncu seçimini kapat">✕</button>
                        </div>
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Oyuncu ara"
                            className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-400/50"
                        />
                        <button type="button" onClick={() => openEditor(createManualEntry(), null)} className="mb-3 w-full rounded-xl border border-dashed border-white/20 px-3 py-3 text-left text-sm font-bold text-slate-200">
                            + Listede olmayan oyuncuyu manuel ekle
                        </button>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {filteredSquad.map((player) => (
                                <button key={player.id} type="button" onClick={() => openEditor(createSquadEntry(player), null)} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left">
                                    <PlayerAvatar player={player} name={player.name} />
                                    <span className="min-w-0 truncate text-xs font-bold text-white">{player.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {editor && (
                <div className="fixed inset-0 z-[160] flex items-end bg-slate-950/80 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Oyuncu durumunu düzenle">
                    <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <p className="text-base font-black text-white">{editingIndex === null ? 'Durum ekle' : 'Durumu düzenle'}</p>
                            <button type="button" onClick={() => setEditor(null)} className="p-2 text-white" aria-label="Durum düzenlemeyi kapat">✕</button>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-xs font-semibold text-slate-300">Oyuncu
                                <input
                                    value={editor.name}
                                    disabled={editor.source === 'squad'}
                                    maxLength={80}
                                    onChange={(event) => setEditor((current) => current ? { ...current, name: event.target.value } : current)}
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white disabled:text-slate-400"
                                />
                            </label>
                            <label className="block text-xs font-semibold text-slate-300">Durum
                                <select
                                    value={editor.status}
                                    onChange={(event) => setEditor((current) => current ? {
                                        ...current,
                                        status: event.target.value as AdminPlayerStatus,
                                        detail: '',
                                        returnDate: ''
                                    } : current)}
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white"
                                >
                                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                </select>
                            </label>
                            <fieldset>
                                <legend className="text-xs font-semibold text-slate-300">Hazır açıklama</legend>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {DESCRIPTION_PRESETS[editor.status].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setEditor((current) => current ? { ...current, detail: preset } : current)}
                                            aria-label={`Açıklama: ${preset}`}
                                            className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${editor.detail === preset
                                                ? 'border-yellow-400 bg-yellow-400 text-slate-950'
                                                : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'}`}
                                        >{preset}</button>
                                    ))}
                                </div>
                            </fieldset>
                            <label className="block text-xs font-semibold text-slate-300">Açıklama (istersen düzenle)
                                <textarea value={editor.detail} maxLength={160} rows={3} onChange={(event) => setEditor((current) => current ? { ...current, detail: event.target.value } : current)} className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" />
                            </label>
                            {(editor.status === 'injured' || editor.status === 'doubtful') && (
                                <>
                                    <fieldset>
                                        <legend className="text-xs font-semibold text-slate-300">Hazır tahmini dönüş</legend>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {RETURN_DATE_PRESETS.map((preset) => (
                                                <button
                                                    key={preset}
                                                    type="button"
                                                    onClick={() => setEditor((current) => current ? { ...current, returnDate: preset } : current)}
                                                    aria-label={`Tahmini dönüş: ${preset}`}
                                                    className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${editor.returnDate === preset
                                                        ? 'border-sky-400 bg-sky-400 text-slate-950'
                                                        : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white'}`}
                                                >{preset}</button>
                                            ))}
                                        </div>
                                    </fieldset>
                                    <label className="block text-xs font-semibold text-slate-300">Tahmini dönüş (istersen düzenle)
                                        <input value={editor.returnDate} maxLength={60} placeholder="Örn. 2 hafta" onChange={(event) => setEditor((current) => current ? { ...current, returnDate: event.target.value } : current)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white" />
                                    </label>
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={editor.name.trim().length < 2}
                            onClick={saveEditor}
                            className="mt-4 w-full rounded-xl bg-yellow-400 px-3 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
                        >Taslağa ekle</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPlayerStatusManager;
