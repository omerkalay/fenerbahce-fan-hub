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

    const request = get(ref(database, path))
        .then((snapshot) => {
            const value = snapshot.val() as CachedSnapshot<T> | null;
            return value?.data ? value : null;
        })
        .catch((error) => {
            console.warn(`Cached ${resource} data could not be loaded:`, error);
            return null;
        });
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
