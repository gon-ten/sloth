import type { RootProps } from '@sloth/core';
import clsx from 'clsx';
import type { AppState } from './types.ts';

export default function Root(
  { Links, Metadata, Component, state }: RootProps<AppState>,
) {
  return (
    <html
      lang='en'
      className={clsx(
        'h-full antialiased',
        state.theme === 'dark' && 'dark',
      )}
    >
      <head>
        <meta charset='UTF-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <Metadata />
        <Links />
      </head>
      <body className='h-full bg-zinc-50 dark:bg-black'>
        <Component />
      </body>
    </html>
  );
}
