"use client";

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';

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

/**
 * M3-styled Theme Toggle
 * Uses FAB-like styling positioned in the corner
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        // Position
        "fixed top-4 right-4 z-50",
        // M3 FAB-like styling (small FAB)
        "flex items-center gap-2",
        "h-10 px-4",
        // M3 pill shape for extended FAB
        "rounded-full",
        // M3 surface container with tonal elevation
        "bg-surface-container-high",
        "text-on-surface",
        // M3 Level 1 elevation
        "shadow-[0_1px_2px_rgba(0,0,0,0.3),0_1px_3px_1px_rgba(0,0,0,0.15)]",
        // Hover state - Level 2 elevation
        "hover:shadow-[0_1px_2px_rgba(0,0,0,0.3),0_2px_6px_2px_rgba(0,0,0,0.15)]",
        "hover:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-high)_92%,var(--md-sys-color-on-surface)_8%)]",
        // Focus state
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        // Active state
        "active:bg-[color-mix(in_srgb,var(--md-sys-color-surface-container-high)_88%,var(--md-sys-color-on-surface)_12%)]",
        // M3 motion
        "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <>
          <Moon className="h-5 w-5" />
          <span className="text-label-large font-medium">Dark</span>
        </>
      ) : (
        <>
          <Sun className="h-5 w-5" />
          <span className="text-label-large font-medium">Light</span>
        </>
      )}
    </button>
  );
}
