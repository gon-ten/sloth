export const THEME_COOKIE_NAME = 'theme';

export const THEMES = ['dark', 'light'] as const;

export type ThemeValue = typeof THEMES[number];
