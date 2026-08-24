import { useEffect, useMemo, useState } from 'react';
import App from '../App';
import {
    buildDevLiveSimulation,
    DEV_LIVE_SCENARIOS,
    resolveDevLiveScenario,
    type DevLiveScenario,
} from './liveMatchSimulation';

const SCENARIO_LABELS: Record<DevLiveScenario, string> = {
    countdown: 'Yeni Tasarım · 1 Gün',
    'pre-match': 'Yeni Tasarım · Başlıyor',
    'first-half': "İlk Yarı · 32'",
    halftime: 'Devre Arası',
    'second-half': "İkinci Yarı · 68'",
    stoppage: "Uzatma · 90+4'",
    finished: 'Maç Bitti',
    'partial-data': "Eksik Veri · 54'",
};

const DevScenarioSelector = ({
    scenario,
    onChange,
}: {
    scenario: DevLiveScenario;
    onChange: (scenario: DevLiveScenario) => void;
}) => (
    <aside data-dev-live-simulator className="dev-live-panel mb-3 rounded-xl border border-dashed border-slate-500/70 bg-[#0a172a] p-3" aria-label="Geliştirme canlı maç simülatörü">
        <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="dev-live-scenario" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Canlı Maç Simülatörü</label>
            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-emerald-300">Yazmalar Kapalı</span>
        </div>
        <select
            id="dev-live-scenario"
            value={scenario}
            onChange={(event) => onChange(event.target.value as DevLiveScenario)}
            className="min-h-11 w-full rounded-lg border border-white/10 bg-slate-900 px-3 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
        >
            {DEV_LIVE_SCENARIOS.map((value) => <option key={value} value={value}>{SCENARIO_LABELS[value]}</option>)}
        </select>
    </aside>
);

export default function DevApp() {
    const [scenario, setScenario] = useState<DevLiveScenario | null>(() => resolveDevLiveScenario(window.location.search, true));

    useEffect(() => {
        const handlePopState = () => setScenario(resolveDevLiveScenario(window.location.search, true));
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const simulation = useMemo(() => scenario ? buildDevLiveSimulation(scenario) : null, [scenario]);

    if (!simulation || !scenario) return <App />;

    const changeScenario = (nextScenario: DevLiveScenario) => {
        const url = new URL(window.location.href);
        url.searchParams.set('mockLive', nextScenario);
        window.history.replaceState(window.history.state, '', url);
        setScenario(nextScenario);
    };

    return (
        <App
            runtimeOverrides={{
                safeMode: true,
                matchData: simulation.matchData,
                liveMatchState: simulation.liveMatchState,
                liveMatchData: simulation.liveMatchData,
                startingXI: simulation.startingXI,
                controls: <DevScenarioSelector scenario={scenario} onChange={changeScenario} />,
            }}
        />
    );
}
