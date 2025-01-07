import { Head } from '@sloth/core/runtime';
import type { LayoutLoader, LayoutProps, UnknownParams } from '@sloth/core';
import { Image } from '@sloth/core/runtime';
import { Backdrop } from '@/🧱/Backdrop.tsx';
import { LayoutRow } from '@/🧱/LayoutRow.tsx';
import type { AppState } from '../types.ts';
import { ThemeContext, ThemeSelector } from '@/🧱/ThemeSelector.tsx';

type Data = Pick<AppState, 'theme'>;

export const loader: LayoutLoader<Data, UnknownParams, AppState> = (
  { ctx },
) => {
  ctx.renderLayout({
    theme: ctx.state.theme,
  });
  return ctx.next();
};

export default function HomeLayout({ Component, data }: LayoutProps<Data>) {
  return (
    <ThemeContext.Provider value={data.theme}>
      <Head>
        <link
          rel='icon'
          href={data.theme === 'dark'
            ? '/static/images/logo_negate.ico'
            : '/static/images/logo.ico'}
        />
      </Head>
      <Backdrop />
      <div className='relative flex w-full flex-col'>
        <LayoutRow className='mt-8'>
          <div className='flex flex-row h-[56px] items-center justify-between '>
            <a href='/'>
              <Image
                width={115}
                height={56}
                loading='lazy'
                decoding='async'
                srcSet='/images/logo.avif 1x'
                alt='Brand logo'
                priority
              />
            </a>
            <ThemeSelector />
          </div>
        </LayoutRow>
        <Component />
      </div>
    </ThemeContext.Provider>
  );
}
