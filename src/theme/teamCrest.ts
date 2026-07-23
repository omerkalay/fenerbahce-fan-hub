import type { ThemeId } from './theme';

export const FENERBAHCE_ANNIVERSARY_CREST_URL =
  `${import.meta.env.BASE_URL}icons/fenerbahce-120-transparent.png`;

const normalizeTeamName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const isFenerbahceTeamName = (name?: string | null): boolean =>
  normalizeTeamName(String(name || '')).includes('fenerbahce');

interface ResolveTeamCrestOptions {
  theme: ThemeId;
  defaultSrc?: string | null;
  teamName?: string | null;
  isFenerbahce?: boolean;
}

export const resolveTeamCrest = ({
  theme,
  defaultSrc = null,
  teamName,
  isFenerbahce = false,
}: ResolveTeamCrestOptions): string | null => {
  if (
    theme === 'white-kit'
    && (isFenerbahce || isFenerbahceTeamName(teamName))
  ) {
    return FENERBAHCE_ANNIVERSARY_CREST_URL;
  }

  return defaultSrc || null;
};
