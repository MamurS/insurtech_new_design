import { useContext } from 'react';
import { ThemeContext } from './ThemeContext';
import { THEMES } from './tokens';
import type { ThemeMode, ThemeTokens } from './tokens';

export function useThemeMode(): ThemeMode {
  return useContext(ThemeContext).theme;
}

export function useThemeTokens(): ThemeTokens {
  const { theme } = useContext(ThemeContext);
  return THEMES[theme];
}

export function useThemeToggle(): () => void {
  return useContext(ThemeContext).toggleTheme;
}

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useContext(ThemeContext);
  const t = THEMES[theme];
  return { theme, setTheme, toggleTheme, t };
}
