export type ThemeId = 'classic' | 'white-kit';

export const THEME_STORAGE_KEY = 'fenerbahce-fan-hub.theme.v1';
export const DEFAULT_THEME: ThemeId = 'classic';

export const THEME_META_COLORS: Record<ThemeId, string> = {
  classic: '#0f172a',
  'white-kit': '#F5F0E1',
};

export const isThemeId = (value: unknown): value is ThemeId =>
  value === 'classic' || value === 'white-kit';

export const loadTheme = (storage?: Pick<Storage, 'getItem'>): ThemeId => {
  if (!storage) return DEFAULT_THEME;

  try {
    const savedTheme = storage.getItem(THEME_STORAGE_KEY);
    return isThemeId(savedTheme) ? savedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
};

export const persistTheme = (
  theme: ThemeId,
  storage?: Pick<Storage, 'setItem'>,
): boolean => {
  if (!storage) return false;

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
};

export const applyThemeToDocument = (
  theme: ThemeId,
  targetDocument?: Document,
): void => {
  if (!targetDocument) return;

  targetDocument.documentElement.dataset.theme = theme;
  targetDocument.documentElement.style.colorScheme = theme === 'white-kit' ? 'light' : 'dark';

  const themeMeta = targetDocument.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeMeta?.setAttribute('content', THEME_META_COLORS[theme]);
};

export const readThemeFromDocument = (targetDocument?: Document): ThemeId => {
  if (!targetDocument) return DEFAULT_THEME;
  const currentTheme = targetDocument.documentElement.dataset.theme;
  return isThemeId(currentTheme) ? currentTheme : DEFAULT_THEME;
};
