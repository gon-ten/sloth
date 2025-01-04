import type {
  InferValidateOptions,
  Metadata,
  PageConfig,
  PageProps,
} from '@sloth/core';
import { Collection, getCollection } from '@sloth/core/content';
import * as v from '@valibot/valibot';
import { LayoutRow } from '@/🧱/LayoutRow.tsx';

export const metadata: Metadata = {
  title: 'Blog entries',
  description: 'A list of all available blog post regarding code world',
};

export const pageConfig = {
  defineValidationSchemas: () => ({
    params: v.object({
      lang: v.string(),
      slug: v.optional(v.string()),
    }),
  }),
} satisfies PageConfig;

type Params = InferValidateOptions<typeof pageConfig, 'params'>;

const intlCache: Map<string, Intl.DateTimeFormat> = new Map();

function formatDate(date: Date | string, lang: string) {
  let formatter: Intl.DateTimeFormat;
  if (intlCache.has(lang)) {
    formatter = intlCache.get(lang)!;
  } else {
    formatter = new Intl.DateTimeFormat([lang], {
      month: 'short',
      day: '2-digit',
      year: '2-digit',
    });
    intlCache.set(lang, formatter);
  }
  return formatter.format(date instanceof Date ? date : new Date(date));
}

const getCollectionByLang = (
  lang: Params['lang'],
): Collection<'blogs/es' | 'blogs/en'> => {
  return getCollection('blogs/' + lang) as Collection<'blogs/es' | 'blogs/en'>;
};

export default function BlogIndex({ params }: PageProps<void, Params>) {
  const { Provider } = getCollectionByLang(params.lang).all();

  return (
    <>
      <LayoutRow className='mt-8'>
        <h1 className='text-default text-5xl'>All Articles</h1>
      </LayoutRow>
      <LayoutRow className='mt-8'>
        <div className='lg:border-l lg:border-default'>
          <Provider>
            {({ name, metadata }) => (
              <section className='relative text-default lg:pl-40'>
                <section className='hidden text-sm lg:inline-flex lg:absolute lg:left-4 lg:top-4'>
                  <time
                    dateTime={new Date(metadata.publishingDate)
                      .toISOString()}
                  >
                    {formatDate(metadata.publishingDate, params.lang)}
                  </time>
                </section>
                <a
                  key={name}
                  href={`/${params.lang}/${name}`}
                  className='block'
                >
                  <section className='group flex flex-row -mx-4 lg:mx-0 p-4 rounded-xl hover:bg-zinc-100 hover:dark:bg-zinc-700/20 transition-colors'>
                    <section className='flex-1'>
                      <section className='border-l-2 border-default group-hover:border-jade-500 text-sm text-default mb-3 pl-3 lg:hidden'>
                        <time
                          dateTime={new Date(metadata.publishingDate)
                            .toISOString()}
                        >
                          {formatDate(metadata.publishingDate, params.lang)}
                        </time>
                      </section>
                      <h2 className='text-base font-semibold'>
                        {metadata.title}
                      </h2>
                      <article className='text-sm mt-2 text-default-secondary line-clamp-3'>
                        {metadata.description}
                      </article>
                    </section>
                    <aside className='basis-40 md:basis-64'>
                      <picture>
                        {metadata.heroImage.thumbnail?.map((
                          { srcSet, type },
                        ) => (
                          <source
                            className='rounded-xl'
                            loading='lazy'
                            type={type}
                            srcSet={srcSet}
                            width={252}
                            height={144}
                            decoding='async'
                          />
                        ))}
                        <img
                          className='rounded-xl'
                          loading='lazy'
                          alt={metadata.heroImage.alt}
                          src={metadata.heroImage.defaultSource.src}
                          width={252}
                          height={144}
                          decoding='async'
                        />
                      </picture>
                    </aside>
                  </section>
                </a>
              </section>
            )}
          </Provider>
        </div>
      </LayoutRow>
    </>
  );
}
