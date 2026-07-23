import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ThemeContext } from './themeContextDef';
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isThemeId,
  loadTheme,
  persistTheme,
  readThemeFromDocument,
  THEME_STORAGE_KEY,
  type ThemeId,
} from '../theme/theme';

const getBrowserStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const getInitialTheme = (): ThemeId => {
  if (typeof document === 'undefined') return DEFAULT_THEME;

  const documentTheme = readThemeFromDocument(document);
  if (document.documentElement.dataset.theme) return documentTheme;
  return loadTheme(getBrowserStorage());
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeId>(getInitialTheme);

  const setTheme = useCallback((nextTheme: ThemeId) => {
    applyThemeToDocument(nextTheme, typeof document === 'undefined' ? undefined : document);
    persistTheme(nextTheme, getBrowserStorage());
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    applyThemeToDocument(theme, document);
    persistTheme(theme, getBrowserStorage());
  }, [theme]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const nextTheme = isThemeId(event.newValue) ? event.newValue : DEFAULT_THEME;
      applyThemeToDocument(nextTheme, document);
      setThemeState(nextTheme);
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
