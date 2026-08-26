import { useEffect, useMemo, useRef, useState } from 'react';
import PlayerImage from '../PlayerImage';
import {
    createAdminNotificationGroup,
    deleteAdminNotificationGroup,
    fetchAdminNotificationGroups,
    fetchAdminNotificationUsers,
    sendAdminNotificationBroadcast,
    sendAdminNotificationTest,
    updateAdminNotificationGroup,
    type AdminNotificationAudience,
    type AdminNotificationDelivery,
    type AdminNotificationGroup,
    type AdminNotificationPayload,
    type AdminNotificationUser,
    type AdminNotificationUserStatus
} from '../../services/admin';

const APP_URL = 'https://omerkalay.com/fenerbahce-fan-hub/';
const MAX_SELECTED_USERS = 25;

type AudienceType = AdminNotificationAudience['type'];
type PickerState =
    | { type: 'audience'; selectedUserUids: string[] }
    | { type: 'group'; group: AdminNotificationGroup | null; name: string; selectedUserUids: string[] };

const STATUS_LABELS: Record<AdminNotificationUserStatus, string> = {
    eligible: 'Bildirim açık',
    no_device: 'Kayıtlı cihaz yok',
    opted_out: 'Genel bildirim kapalı',
    disabled: 'Hesap devre dışı',
    unsupported: 'Bu hesap seçilemiyor'
};

const AUDIENCE_LABELS: Record<AudienceType, string> = {
    topic: 'Tüm taraftarlar',
    users: 'Kullanıcı seç',
    group: 'Kayıtlı grup'
};

const sortUserIds = (values: string[]) => [...new Set(values)].sort();

const AdminNotificationManager = () => {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState(APP_URL);
    const [audienceType, setAudienceType] = useState<AudienceType>('topic');
    const [selectedUserUids, setSelectedUserUids] = useState<string[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [groups, setGroups] = useState<AdminNotificationGroup[]>([]);
    const [users, setUsers] = useState<AdminNotificationUser[]>([]);
    const [nextPageToken, setNextPageToken] = useState<string | null>(null);
    const [directoryLoaded, setDirectoryLoaded] = useState(false);
    const [picker, setPicker] = useState<PickerState | null>(null);
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [directoryBusy, setDirectoryBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [tested, setTested] = useState<{ id: string; expiresAt: number } | null>(null);
    const previousSignatureRef = useRef('');

    const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;
    const audience = useMemo<AdminNotificationAudience>(() => {
        if (audienceType === 'users') return { type: 'users', userUids: sortUserIds(selectedUserUids) };
        if (audienceType === 'group' && selectedGroup) {
            return { type: 'group', groupId: selectedGroup.id, revision: selectedGroup.revision };
        }
        return { type: 'topic', topic: 'all_fans' };
    }, [audienceType, selectedGroup, selectedUserUids]);
    const payload = useMemo<AdminNotificationPayload>(() => ({ title, body, url, audience }), [audience, body, title, url]);
    const signature = useMemo(() => JSON.stringify(payload), [payload]);
    const audienceReady = audienceType === 'topic'
        || (audienceType === 'users' && selectedUserUids.length > 0)
        || (audienceType === 'group' && Boolean(selectedGroup));

    useEffect(() => {
        let cancelled = false;
        void fetchAdminNotificationGroups()
            .then((result) => {
                if (cancelled) return;
                setGroups(result.groups);
                setSelectedGroupId((current) => (
                    current && result.groups.some((group) => group.id === current)
                        ? current
                        : (result.groups[0]?.id || '')
                ));
            })
            .catch((requestError) => {
                if (!cancelled) setError((requestError as Error).message);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!previousSignatureRef.current) {
            previousSignatureRef.current = signature;
            return;
        }
        if (previousSignatureRef.current !== signature) {
            previousSignatureRef.current = signature;
            setTested(null);
        }
    }, [signature]);

    const mergeUsers = (incoming: AdminNotificationUser[], reset: boolean) => {
        setUsers((current) => {
            const map = new Map((reset ? [] : current).map((user) => [user.id, user]));
            incoming.forEach((user) => map.set(user.id, user));
            return [...map.values()];
        });
    };

    const loadUsers = async (pageToken?: string) => {
        setDirectoryBusy(true);
        setError(null);
        try {
            const result = await fetchAdminNotificationUsers(pageToken);
            mergeUsers(result.users, !pageToken);
            setNextPageToken(result.nextPageToken);
            setDirectoryLoaded(true);
        } catch (requestError) {
            setError((requestError as Error).message);
        } finally {
            setDirectoryBusy(false);
        }
    };

    const ensureUsers = () => {
        if (!directoryLoaded && !directoryBusy) void loadUsers();
    };

    const openAudiencePicker = () => {
        setPicker({ type: 'audience', selectedUserUids });
        setSearch('');
        ensureUsers();
    };

    const openGroupPicker = (group: AdminNotificationGroup | null, initialUserUids: string[] = []) => {
        setPicker({
            type: 'group',
            group,
            name: group?.name || '',
            selectedUserUids: group?.userUids || initialUserUids
        });
        setSearch('');
        ensureUsers();
    };

    const togglePickerUser = (user: AdminNotificationUser) => {
        if (!picker || !user.eligible) return;
        const selected = picker.selectedUserUids.includes(user.id);
        if (!selected && picker.selectedUserUids.length >= MAX_SELECTED_USERS) {
            setError(`En fazla ${MAX_SELECTED_USERS} kullanıcı seçebilirsin.`);
            return;
        }
        const next = selected
            ? picker.selectedUserUids.filter((uid) => uid !== user.id)
            : sortUserIds([...picker.selectedUserUids, user.id]);
        setPicker({ ...picker, selectedUserUids: next });
        setError(null);
    };

    const savePicker = async () => {
        if (!picker) return;
        if (picker.selectedUserUids.length < 1) {
            setError('En az bir bildirim kullanıcısı seçmelisin.');
            return;
        }
        if (picker.type === 'audience') {
            setSelectedUserUids(sortUserIds(picker.selectedUserUids));
            setAudienceType('users');
            setPicker(null);
            setNotice(`${picker.selectedUserUids.length} kullanıcı gönderim için seçildi.`);
            return;
        }
        if (picker.name.trim().length < 2) {
            setError('Grup adı en az 2 karakter olmalı.');
            return;
        }

        setBusy(true);
        setError(null);
        try {
            const result = picker.group
                ? await updateAdminNotificationGroup(picker.group, picker.name, picker.selectedUserUids)
                : await createAdminNotificationGroup(picker.name, picker.selectedUserUids);
            setGroups((current) => [
                result.group,
                ...current.filter((group) => group.id !== result.group.id)
            ]);
            setSelectedGroupId(result.group.id);
            setAudienceType('group');
            setPicker(null);
            setNotice(picker.group ? 'Bildirim grubu güncellendi.' : 'Bildirim grubu kaydedildi.');
        } catch (requestError) {
            setError((requestError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const deleteGroup = async (group: AdminNotificationGroup) => {
        const confirmed = window.confirm(`“${group.name}” bildirim grubunu silmek istediğine emin misin?`);
        if (!confirmed) return;
        setBusy(true);
        setError(null);
        try {
            await deleteAdminNotificationGroup(group);
            const remaining = groups.filter((candidate) => candidate.id !== group.id);
            setGroups(remaining);
            if (selectedGroupId === group.id) setSelectedGroupId(remaining[0]?.id || '');
            setNotice('Bildirim grubu silindi.');
        } catch (requestError) {
            setError((requestError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const testNotification = async () => {
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const result = await sendAdminNotificationTest(payload);
            setTested({ id: result.testId, expiresAt: result.expiresAt });
            setNotice('Test bildirimi yalnızca kendi kayıtlı cihazına gönderildi.');
        } catch (requestError) {
            setError((requestError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const targetLabel = audienceType === 'topic'
        ? 'tüm taraftarlar'
        : audienceType === 'users'
            ? `${selectedUserUids.length} seçili kullanıcı`
            : `“${selectedGroup?.name || 'seçilmemiş'}” grubu`;

    const sendNotification = async () => {
        if (!tested) return;
        const confirmed = window.confirm(`Test ettiğin aynı bildirimi ${targetLabel} hedefine göndermek istediğine emin misin?`);
        if (!confirmed) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const result = await sendAdminNotificationBroadcast(payload, tested.id);
            setTested(null);
            const delivery: AdminNotificationDelivery | undefined = result.delivery;
            setNotice(delivery
                ? `Gönderim tamamlandı: ${delivery.accepted} kabul, ${delivery.failed} hata, ${delivery.skipped} atlandı.`
                : 'Firebase tüm taraftarlar bildirimini kabul etti.');
        } catch (requestError) {
            setError((requestError as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const searchKey = search.trim().toLocaleLowerCase('tr-TR');
    const filteredUsers = users.filter((user) => !searchKey || (
        user.displayName.toLocaleLowerCase('tr-TR').includes(searchKey)
        || String(user.maskedEmail || '').toLocaleLowerCase('tr-TR').includes(searchKey)
    ));

    return (
        <div className="mx-auto max-w-2xl space-y-4">
            {error && <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{error}</div>}
            {notice && <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">{notice}</div>}

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                    <p className="text-sm font-black text-white">Bildirim içeriği</p>
                    <p className="mt-1 text-[11px] text-slate-400">Önce kendi cihazında test et; içerik veya hedef değişirse onay sıfırlanır.</p>
                </div>
                <label className="block text-xs font-semibold text-slate-300">Başlık
                    <input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                </label>
                <label className="block text-xs font-semibold text-slate-300">Mesaj
                    <textarea value={body} maxLength={180} rows={4} onChange={(event) => setBody(event.target.value)} className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                </label>
                <label className="block text-xs font-semibold text-slate-300">Bağlantı
                    <input aria-label="Bağlantı" value={url} maxLength={300} onChange={(event) => setUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                    <span className="mt-1 block text-[10px] font-normal text-slate-500">Fan Hub, resmî Fenerbahçe X profili/gönderisi veya Instagram profil/gönderi bağlantısı.</span>
                </label>
                <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-4">
                    <p className="text-sm font-black text-white">{title || 'Bildirim başlığı'}</p>
                    <p className="mt-1 text-xs text-slate-300">{body || 'Bildirim mesajı burada görünür.'}</p>
                    <p className="mt-2 truncate text-[10px] text-slate-500">Hedef: {targetLabel}</p>
                </div>
            </section>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                    <p className="text-sm font-black text-white">Gönderim hedefi</p>
                    <p className="mt-1 text-[11px] text-slate-400">Kullanıcı dizini yalnızca bu ekran açıldığında ve sen istediğinde yüklenir.</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(AUDIENCE_LABELS) as AudienceType[]).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => {
                                setAudienceType(type);
                                setPicker(null);
                                setSearch('');
                            }}
                            className={`min-h-11 rounded-lg px-2 py-2 text-[11px] font-black transition-colors ${audienceType === type ? 'bg-yellow-400 text-slate-950' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
                        >
                            {AUDIENCE_LABELS[type]}
                        </button>
                    ))}
                </div>

                {audienceType === 'users' && (
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold text-white">Tek seferlik seçim</p>
                                <p className="mt-1 text-[10px] text-slate-400">{selectedUserUids.length}/{MAX_SELECTED_USERS} kullanıcı seçildi</p>
                            </div>
                            <button type="button" onClick={openAudiencePicker} className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold text-white hover:bg-slate-700">Kullanıcıları seç</button>
                        </div>
                        {selectedUserUids.length > 0 && (
                            <button type="button" onClick={() => openGroupPicker(null, selectedUserUids)} className="mt-3 w-full rounded-lg border border-yellow-400/25 bg-yellow-400/10 px-3 py-2 text-[11px] font-bold text-yellow-200">Bu seçimi grup olarak kaydet</button>
                        )}
                    </div>
                )}

                {audienceType === 'group' && (
                    <div className="space-y-2">
                        {groups.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-[11px] text-slate-400">Henüz kayıtlı bildirim grubu yok.</p>
                        ) : groups.map((group) => (
                            <button
                                key={group.id}
                                type="button"
                                onClick={() => setSelectedGroupId(group.id)}
                                className={`flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left ${selectedGroupId === group.id ? 'border-yellow-400/60 bg-yellow-400/10' : 'border-white/10 bg-slate-950/50'}`}
                            >
                                <span>
                                    <span className="block text-xs font-bold text-white">{group.name}</span>
                                    <span className="mt-0.5 block text-[10px] text-slate-400">{group.userUids.length} kayıtlı kullanıcı</span>
                                </span>
                                <span className="text-[10px] font-bold text-yellow-300">{selectedGroupId === group.id ? 'Seçili' : 'Seç'}</span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-white">Kayıtlı gruplar</p>
                        <p className="mt-1 text-[11px] text-slate-400">Sık kullandığın arkadaş listelerini kaydet ve düzenle.</p>
                    </div>
                    <button type="button" onClick={() => openGroupPicker(null)} className="rounded-lg bg-yellow-400 px-3 py-2 text-[11px] font-black text-slate-950">Yeni grup</button>
                </div>
                {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-white">{group.name}</p>
                            <p className="text-[10px] text-slate-500">{group.userUids.length} kullanıcı · revizyon {group.revision}</p>
                        </div>
                        <div className="flex gap-2">
                            <button type="button" disabled={busy} onClick={() => openGroupPicker(group)} className="rounded-md bg-slate-800 px-2 py-1.5 text-[10px] font-bold text-slate-200 disabled:opacity-40">Düzenle</button>
                            <button type="button" disabled={busy} onClick={() => void deleteGroup(group)} className="rounded-md bg-red-500/15 px-2 py-1.5 text-[10px] font-bold text-red-200 disabled:opacity-40">Sil</button>
                        </div>
                    </div>
                ))}
            </section>

            {picker && (
                <section className="space-y-3 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-sm font-black text-white">{picker.type === 'audience' ? 'Kullanıcı seç' : picker.group ? 'Grubu düzenle' : 'Yeni grup'}</p>
                            <p className="mt-1 text-[11px] text-slate-400">Yalnız genel bildirimleri açık ve kayıtlı cihazı olan kullanıcılar seçilebilir.</p>
                        </div>
                        <button type="button" aria-label="Kullanıcı seçiciyi kapat" onClick={() => setPicker(null)} className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-bold text-white">×</button>
                    </div>
                    {picker.type === 'group' && (
                        <label className="block text-xs font-semibold text-slate-300">Grup adı
                            <input value={picker.name} maxLength={40} onChange={(event) => setPicker({ ...picker, name: event.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-white" />
                        </label>
                    )}
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ad veya maskeli e-posta ile filtrele" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white" />
                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {directoryBusy && users.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Kullanıcılar yükleniyor...</p>}
                        {!directoryBusy && !directoryLoaded && users.length === 0 && (
                            <div className="space-y-2 py-4 text-center">
                                <p className="text-xs text-slate-400">Kullanıcı listesi yüklenemedi.</p>
                                <button type="button" onClick={() => void loadUsers()} className="rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold text-white">Tekrar dene</button>
                            </div>
                        )}
                        {!directoryBusy && directoryLoaded && filteredUsers.length === 0 && <p className="py-4 text-center text-xs text-slate-400">Eşleşen kullanıcı bulunamadı.</p>}
                        {filteredUsers.map((user) => {
                            const selected = picker.selectedUserUids.includes(user.id);
                            return (
                                <label key={user.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${selected ? 'border-yellow-400/50 bg-yellow-400/10' : 'border-white/10 bg-slate-950/60'} ${user.eligible ? 'cursor-pointer' : 'opacity-55'}`}>
                                    <input type="checkbox" checked={selected} disabled={!user.eligible} onChange={() => togglePickerUser(user)} className="h-4 w-4 accent-yellow-400" />
                                    <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/15 bg-slate-800">
                                        <PlayerImage src={user.photoURL} alt={user.displayName} className="h-full w-full object-cover" fallback={<span className="flex h-full w-full items-center justify-center text-xs font-black text-slate-300">{user.displayName.slice(0, 1).toUpperCase()}</span>} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-bold text-white">{user.displayName}</span>
                                        <span className="block truncate text-[10px] text-slate-400">{user.maskedEmail || 'E-posta bilgisi yok'}</span>
                                    </span>
                                    <span className={`text-right text-[9px] font-bold ${user.eligible ? 'text-emerald-300' : 'text-slate-500'}`}>{STATUS_LABELS[user.notificationStatus]}</span>
                                </label>
                            );
                        })}
                    </div>
                    {nextPageToken && (
                        <button type="button" disabled={directoryBusy} onClick={() => void loadUsers(nextPageToken)} className="w-full rounded-lg bg-slate-800 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40">Daha fazla kullanıcı yükle</button>
                    )}
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] text-slate-400">{picker.selectedUserUids.length}/{MAX_SELECTED_USERS} seçili</p>
                        <button type="button" disabled={busy || picker.selectedUserUids.length === 0} onClick={() => void savePicker()} className="rounded-lg bg-yellow-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-40">{picker.type === 'audience' ? 'Seçimi kullan' : 'Grubu kaydet'}</button>
                    </div>
                </section>
            )}

            <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" disabled={busy || !title.trim() || !body.trim() || !audienceReady} onClick={() => void testNotification()} className="min-h-12 rounded-xl bg-blue-500 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Önce bana test gönder</button>
                    <button type="button" disabled={busy || !tested || !audienceReady} onClick={() => void sendNotification()} className="min-h-12 rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{audienceType === 'topic' ? 'Tüm taraftarlara gönder' : 'Seçili hedefe gönder'}</button>
                </div>
                <p className="text-[11px] text-slate-500">{tested ? `Test onayı hazır; ${new Date(tested.expiresAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} saatine kadar tek kullanımlık.` : 'Gönderimden önce kendi cihazındaki test zorunludur.'}</p>
            </section>
        </div>
    );
};

export default AdminNotificationManager;
