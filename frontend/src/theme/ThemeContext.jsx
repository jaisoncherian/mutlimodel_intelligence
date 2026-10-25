import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const THEME_STORAGE_KEY = 'doculens_theme';

export const ThemeContext = createContext({
  theme: 'system',
  setTheme: () => {},
  isDark: false,
});

/**
 * Safely reads stored theme choice from localStorage.
 * Defaults to 'system' if missing or if localStorage access fails.
 */
function getSavedTheme() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
  } catch {
    // Storage access may throw in sandboxed/private browsing environments
  }
  return 'system';
}

/**
 * Safely persists theme choice to localStorage.
 */
function saveTheme(theme) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // Gracefully handle storage failure
  }
}

/**
 * Determines whether dark mode is currently active given the theme mode and OS preference.
 */
function computeIsDark(themeMode) {
  if (themeMode === 'dark') return true;
  if (themeMode === 'light') return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    try {
      return Boolean(window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      return false;
    }
  }
  return false;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getSavedTheme);
  const [isDark, setIsDark] = useState(() => computeIsDark(getSavedTheme()));

  // Applies the theme to the <html> documentElement classList
  const applyTheme = useCallback((themeMode) => {
    const activeDark = computeIsDark(themeMode);
    setIsDark(activeDark);

    if (typeof document !== 'undefined' && document.documentElement) {
      if (activeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const setTheme = useCallback(
    (newTheme) => {
      setThemeState(newTheme);
      saveTheme(newTheme);
      applyTheme(newTheme);
    },
    [applyTheme]
  );

  // Apply theme on mount and monitor OS theme changes when in 'system' mode
  useEffect(() => {
    applyTheme(theme);

    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    try {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        applyTheme('system');
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
        return () => mediaQuery.removeEventListener('change', handleMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
        return () => mediaQuery.removeListener(handleMediaChange);
      }
    } catch {
      // Graceful fallback for non-standard test runners
    }
  }, [theme, applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
