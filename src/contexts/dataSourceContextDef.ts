import { createContext, useContext } from 'react';
import { DEFAULT_DATA_SOURCE_MODES } from '../services/api/data-source';
import type { DataSourceModes } from '../types';

export interface DataSourceContextValue {
    modes: DataSourceModes;
    loading: boolean;
}

export const DataSourceContext = createContext<DataSourceContextValue>({
    modes: DEFAULT_DATA_SOURCE_MODES,
    loading: true,
});

export const useDataSource = (): DataSourceContextValue => useContext(DataSourceContext);
