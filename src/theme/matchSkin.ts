import type { MatchData } from '../types';
import type { ThemeId } from './theme';

/**
 * A match skin is not a user preference: it is derived from the upcoming
 * fixture. The dashboard switches to the Champions League night look while the
 * next match belongs to that competition, then falls back on its own.
 */
export type MatchSkin = 'default' | 'ucl-night';

const CHAMPIONS_LEAGUE_PATTERN = /champions league|şampiyonlar ligi|sampiyonlar ligi/i;

export const isChampionsLeagueMatch = (match: MatchData | null | undefined): boolean => {
  if (!match) return false;

  const names = [
    match.tournament?.uniqueTournament?.name,
    match.tournament?.name,
  ];

  return names.some((name) => typeof name === 'string' && CHAMPIONS_LEAGUE_PATTERN.test(name));
};

/**
 * Only the classic (dark) theme carries the skin — the white-kit print system
 * keeps its own identity.
 */
export const resolveMatchSkin = (
  match: MatchData | null | undefined,
  theme: ThemeId,
): MatchSkin => (theme === 'classic' && isChampionsLeagueMatch(match) ? 'ucl-night' : 'default');
