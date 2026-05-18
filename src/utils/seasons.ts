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
