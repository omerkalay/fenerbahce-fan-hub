// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useTheme } from '../contexts/themeContextDef';
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  loadTheme,
  persistTheme,
  THEME_STORAGE_KEY,
} from './theme';

const ThemeHarness = () => {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme('white-kit')}>
      {theme}
    </button>
  );
};

describe('theme storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('style');
    document.head.innerHTML = '<meta name="theme-color" content="#0f172a">';
  });

  it('falls back to classic for missing and invalid values', () => {
    expect(loadTheme(window.localStorage)).toBe(DEFAULT_THEME);

    window.localStorage.setItem(THEME_STORAGE_KEY, 'unknown-theme');
    expect(loadTheme(window.localStorage)).toBe(DEFAULT_THEME);
  });

  it('loads and persists a valid theme', () => {
    expect(persistTheme('white-kit', window.localStorage)).toBe(true);
    expect(loadTheme(window.localStorage)).toBe('white-kit');
  });

  it('survives storage access errors', () => {
    const throwingStorage = {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    };

    expect(loadTheme(throwingStorage)).toBe(DEFAULT_THEME);
    expect(persistTheme('white-kit', throwingStorage)).toBe(false);
  });

  it('applies the document theme and browser chrome color together', () => {
    applyThemeToDocument('white-kit', document);

    expect(document.documentElement.dataset.theme).toBe('white-kit');
    expect(document.documentElement.style.colorScheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#F5F0E1');
  });
});

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'classic';
    document.head.innerHTML = '<meta name="theme-color" content="#0f172a">';
  });

  it('updates the UI, document, and local storage immediately', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'classic' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'white-kit' })).toBeDefined();
    });
    expect(document.documentElement.dataset.theme).toBe('white-kit');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('white-kit');
  });

  it('reacts to a theme change from another tab', async () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: THEME_STORAGE_KEY,
        newValue: 'white-kit',
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'white-kit' })).toBeDefined();
    });
    expect(document.documentElement.dataset.theme).toBe('white-kit');
  });
});
