import { CalendarDays, ChevronDown } from 'lucide-react';
import type { SeasonOption } from '../utils/seasons';

interface SeasonSelectorProps {
    value: number;
    options: SeasonOption[];
    onChange: (seasonStartYear: number) => void;
    compact?: boolean;
    minimal?: boolean;
    className?: string;
}

const SeasonSelector: React.FC<SeasonSelectorProps> = ({
    value,
    options,
    onChange,
    compact = false,
    minimal = false,
    className = ''
}) => {
    if (minimal) {
        return (
            <label className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 ${className}`}>
                <CalendarDays size={13} className="text-yellow-300 shrink-0" />
                <span className="relative inline-flex items-center">
                    <select
                        value={value}
                        onChange={(event) => onChange(Number(event.target.value))}
                        className="appearance-none bg-transparent pr-5 text-xs font-bold text-white focus:outline-none"
                        aria-label="Sezon seç"
                    >
                        {options.map((option) => (
                            <option key={option.startYear} value={option.startYear} className="bg-slate-950 text-white">
                                {option.label}{option.badge ? ` (${option.badge})` : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={12}
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                </span>
            </label>
        );
    }

    return (
        <label className={`glass-panel rounded-2xl border border-white/10 flex items-center gap-2.5 ${compact ? 'px-3 py-2' : 'p-3'} ${className}`}>
            <span className="h-9 w-9 rounded-xl bg-yellow-400/10 text-yellow-300 border border-yellow-400/20 inline-flex items-center justify-center shrink-0">
                <CalendarDays size={17} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 leading-none mb-1">
                    Sezon
                </span>
                <span className="relative block">
                    <select
                        value={value}
                        onChange={(event) => onChange(Number(event.target.value))}
                        className="w-full appearance-none bg-transparent pr-6 text-sm font-bold text-white focus:outline-none"
                        aria-label="Sezon seç"
                    >
                        {options.map((option) => (
                            <option key={option.startYear} value={option.startYear} className="bg-slate-950 text-white">
                                {option.label}{!compact && option.badge ? ` (${option.badge})` : ''}
                            </option>
                        ))}
                    </select>
                    <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                </span>
            </span>
        </label>
    );
};

export default SeasonSelector;
