"use client";

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'theme';

type ThemePreference = 'light' | 'dark';

const getPreferredTheme = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredTheme = (): ThemePreference | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>('dark');

  useEffect(() => {
    const initialTheme = getStoredTheme() ?? getPreferredTheme();
    document.documentElement.dataset.theme = initialTheme;
    setTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme: ThemePreference = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-2 text-ui-tab font-medium text-foreground shadow-sm transition hover:bg-surface-muted"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <>
          <Moon className="h-4 w-4" />
          Dark
        </>
      ) : (
        <>
          <Sun className="h-4 w-4" />
          Light
        </>
      )}
    </button>
  );
}
