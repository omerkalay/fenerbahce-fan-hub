import { createContext, useContext } from 'react';
import type { ThemeId } from '../theme/theme';

export interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: 'classic',
  setTheme: () => undefined,
});

export const useTheme = () => useContext(ThemeContext);
