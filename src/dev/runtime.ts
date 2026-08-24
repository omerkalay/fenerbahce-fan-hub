import { resolveDevLiveScenario } from './liveMatchSimulation';

export const isDevLiveMockRequested = (): boolean => resolveDevLiveScenario(window.location.search, true) !== null;

