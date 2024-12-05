import { type Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  content: [
    './components/**/*.tsx',
    './collections/**/*.mdx',
    './routes/**/*.tsx',
    './__root.tsx',
  ],
  darkMode: 'selector',
  theme: {
    extend: {
      colors: {
        jade: {
          50: '#effef7',
          100: '#dafeef',
          200: '#b8fadd',
          300: '#81f4c3',
          400: '#43e5a0',
          500: '#1acd81',
          600: '#0fa968',
          700: '#108554',
          800: '#126945',
          900: '#11563a',
          950: '#03301f',
        },
      },
      boxShadow: {
        bezel:
          'inset 0 2px 0 0 hsla(0, 0%, 100%, .2), inset 0 -1px 0 0 rgba(0, 0, 0, .25), 0 2px 6px 0 rgba(0, 0, 0, .1)',
      },
    },
    fontFamily: {
      sans: ['sans-serif'],
    },
  },
  plugins: [typography],
} satisfies Config;
