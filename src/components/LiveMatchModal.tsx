import { useEffect, useRef } from 'react';
import LiveMatchScore from './LiveMatchScore';
import type { LiveMatchData } from '../types';

interface LiveMatchModalProps {
    visible: boolean;
    onClose: () => void;
    liveMatchData: LiveMatchData | null;
    useSquadPhotos?: boolean;
}

const LiveMatchModal: React.FC<LiveMatchModalProps> = ({ visible, onClose, liveMatchData, useSquadPhotos = true }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!visible) return;
        const previouslyFocused = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            previouslyFocused?.focus();
        };
    }, [onClose, visible]);

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-5" onMouseDown={onClose}>
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="live-match-dialog-title"
                className="live-match-dialog flex max-h-[96dvh] min-h-[72dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#061225] shadow-2xl sm:min-h-0 sm:rounded-3xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <header className="live-match-dialog-header flex shrink-0 items-center justify-between border-b border-white/10 bg-[#061225]/95 px-4 py-3 backdrop-blur-md sm:px-5">
                    <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-yellow-300">Fenerbahçe Hub</p>
                        <h2 id="live-match-dialog-title" className="mt-0.5 truncate text-base font-black text-white">Canlı Maç Merkezi</h2>
                    </div>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
                        aria-label="Canlı maç merkezini kapat"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar sm:p-5">
                    {liveMatchData ? (
                        <LiveMatchScore data={liveMatchData} useSquadPhotos={useSquadPhotos} />
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-600/70 px-4 py-10 text-center text-sm text-slate-400">
                            Canlı maç verisi bulunamadı.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveMatchModal;
