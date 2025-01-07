import type { RootProps } from '@sloth/core';
import clsx from 'clsx';
import type { AppState } from './types.ts';

export default function Root(
  { Component, state, Head }: RootProps<AppState>,
) {
  return (
    <html
      lang='en'
      className={clsx(
        'h-full antialiased',
        state.theme === 'dark' && 'dark',
      )}
    >
      <Head>
        <meta charset='UTF-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
        <link rel='stylesheet' href='/static/styles.css' />
      </Head>
      <body className='h-full bg-zinc-50 dark:bg-black'>
        <Component />
      </body>
    </html>
  );
}
