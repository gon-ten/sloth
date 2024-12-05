import { ThemeValue } from '@/🛠️/theme.ts';
import type { Middleware } from '@sloth/core';

export type AppState = {
  theme: ThemeValue;
};

export type AppMiddleware = Middleware<AppState>;
