import { useEffect, useState, type ReactNode } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../firebase';
import { DEFAULT_DATA_SOURCE_MODES, normalizeDataSourceModes } from '../services/api/data-source';
import type { DataSourceModes } from '../types';
import { DataSourceContext } from './dataSourceContextDef';

export const DataSourceProvider = ({ children }: { children: ReactNode }) => {
    const [modes, setModes] = useState<DataSourceModes>(DEFAULT_DATA_SOURCE_MODES);
    const [loading, setLoading] = useState(true);

    useEffect(() => onValue(
        ref(database, 'cache/dataSourceModes'),
        (snapshot) => {
            setModes(normalizeDataSourceModes(snapshot.val()));
            setLoading(false);
        },
        (error) => {
            console.warn('Data source modes could not be loaded; ESPN remains active:', error);
            setModes(DEFAULT_DATA_SOURCE_MODES);
            setLoading(false);
        }
    ), []);

    return (
        <DataSourceContext.Provider value={{ modes, loading }}>
            {children}
        </DataSourceContext.Provider>
    );
};
