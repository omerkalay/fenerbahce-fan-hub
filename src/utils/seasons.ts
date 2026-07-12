export interface SeasonOption {
  startYear: number;
  label: string;
  badge?: string;
}

export const getCurrentSeasonStartYear = (referenceDate = new Date()): number => {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();
  return month >= 6 ? year : year - 1;
};

export const formatSeasonLabel = (startYear: number): string =>
  `${startYear}/${String(startYear + 1).slice(-2)}`;

export const isHistoricalSeason = (
  seasonStartYear: number,
  referenceDate = new Date()
): boolean => seasonStartYear < getCurrentSeasonStartYear(referenceDate);

export const isDateInSeason = (date: string, seasonStartYear: number): boolean => {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return false;

  const seasonStart = Date.UTC(seasonStartYear, 6, 1);
  const nextSeasonStart = Date.UTC(seasonStartYear + 1, 6, 1);

  return timestamp >= seasonStart && timestamp < nextSeasonStart;
};

export const getRecentSeasonOptions = (
  referenceDate = new Date(),
  count = 3
): SeasonOption[] => {
  const currentStartYear = getCurrentSeasonStartYear(referenceDate);

  return Array.from({ length: count }, (_, index) => {
    const startYear = currentStartYear - index;
    return {
      startYear,
      label: formatSeasonLabel(startYear),
      badge: index === 0 ? 'Güncel' : undefined
    };
  });
};
