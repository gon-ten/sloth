import { useSignal, useSignalEffect } from '@preact/signals';
import { IS_BROWSER } from '@sloth/core/runtime';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { THEME_COOKIE_NAME, type ThemeValue } from '@/🛠️/theme.ts';
import { Sun } from '../icons/Sun.tsx';
import { Moon } from '../icons/Moon.tsx';

export const ThemeContext = createContext<ThemeValue>('light');

export const useTheme = () => {
  return useContext(ThemeContext);
};

function saveUserPreference(value: ThemeValue | undefined) {
  if (!IS_BROWSER) {
    return;
  }
  document.cookie = `${THEME_COOKIE_NAME}=${value}; SameSite=Lax; Path=/;`;
}

export const ThemeSelector = () => {
  const theme = useContext(ThemeContext);

  const userPreference = useSignal<ThemeValue | undefined>(theme);

  useSignalEffect(() => {
    saveUserPreference(userPreference.value);
  });

  useSignalEffect(() => {
    if (userPreference.value === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const toggleTheme = () => {
    const currentValue = userPreference.peek();
    userPreference.value = currentValue === 'dark' ? 'light' : 'dark';
  };

  return (
    <button
      aria-label='Toggle user interface theme'
      onClick={() => toggleTheme()}
      className='inline-flex items-center justify-center rounded-full text-jade-500 hover:text-jade-600 dark:text-zinc-300 dark:hover:text-zinc-400 bg-white/90 px-3 py-2 shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur transition dark:bg-zinc-800/90 dark:ring-white/10 dark:hover:ring-white/20'
    >
      {userPreference.value === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
};
