export interface FixtureFilterItem {
    id: string;
    label: string;
}

export const COMPETITION_FILTERS: FixtureFilterItem[] = [
    { id: 'all', label: 'Tümü' },
    { id: 'superlig', label: 'Süper Lig' },
    { id: 'europe', label: 'Avrupa' },
    { id: 'cup', label: 'Türkiye Kupası' }
];
