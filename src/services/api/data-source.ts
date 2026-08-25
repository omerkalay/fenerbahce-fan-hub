import { get, ref } from 'firebase/database';
import { database } from '../../firebase';
import type {
    CachedSnapshot,
    DataSourceModes,
    DataSourceResource,
    FixtureData,
    FormResult,
    PlayerStat,
    StandingsData,
} from '../../types';

export const DEFAULT_DATA_SOURCE_MODES: DataSourceModes = {
    fixtures: 'espn',
    standings: 'espn',
    statistics: 'espn',
};

export interface CachedStatisticsData {
    players: PlayerStat[];
    form: FormResult[];
}

const snapshotRequests = new Map<string, Promise<unknown>>();

export const normalizeDataSourceModes = (value: unknown): DataSourceModes => {
    const raw = value && typeof value === 'object' ? value as Partial<DataSourceModes> : {};
    return {
        fixtures: raw.fixtures === 'cache' ? 'cache' : 'espn',
        standings: raw.standings === 'cache' ? 'cache' : 'espn',
        statistics: raw.statistics === 'cache' ? 'cache' : 'espn',
    };
};

export const readCachedSnapshot = async <T>(
    resource: DataSourceResource,
    seasonStartYear: number,
    force = false
): Promise<CachedSnapshot<T> | null> => {
    const path = `cache/dataSnapshots/${seasonStartYear}/${resource}`;
    if (!force && snapshotRequests.has(path)) {
        return snapshotRequests.get(path) as Promise<CachedSnapshot<T> | null>;
    }

    // A missing or unreadable snapshot is not cached, so a later attempt can still
    // find the node once the scheduled refresh or an administrator has written it.
    const request = (async (): Promise<CachedSnapshot<T> | null> => {
        try {
            const snapshot = await get(ref(database, path));
            const value = snapshot.val() as CachedSnapshot<T> | null;
            if (value?.data) return value;
        } catch (error) {
            console.warn(`Cached ${resource} data could not be loaded:`, error);
        }
        snapshotRequests.delete(path);
        return null;
    })();
    snapshotRequests.set(path, request);
    return request;
};

export const readCachedFixtures = async (seasonStartYear: number, force = false): Promise<FixtureData | null> => (
    (await readCachedSnapshot<FixtureData>('fixtures', seasonStartYear, force))?.data ?? null
);

export const readCachedStandings = async (seasonStartYear: number, force = false): Promise<StandingsData | null> => (
    (await readCachedSnapshot<StandingsData>('standings', seasonStartYear, force))?.data ?? null
);

export const readCachedStatistics = async (seasonStartYear: number, force = false): Promise<CachedStatisticsData | null> => (
    (await readCachedSnapshot<CachedStatisticsData>('statistics', seasonStartYear, force))?.data ?? null
);
