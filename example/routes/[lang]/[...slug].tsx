import type {
  GenerateMetadataFunction,
  InferValidateOptions,
  Loader,
  PageConfig,
  PageProps,
} from '@sloth/core';
import { getCollection } from '@sloth/core/content';
import * as v from '@valibot/valibot';
import { BlogHeroImage } from '@/🧱/BlogHeroImage.tsx';
import { LayoutRow } from '@/🧱/LayoutRow.tsx';
import { ArrowLeft } from '../../icons/ArrowLeft.tsx';

export const metadata: GenerateMetadataFunction<Params> = ({ params }) => {
  const { metadata } = getCollection('blogs').get(params.slug);
  return {
    title: metadata.title,
    description: metadata.description,
  };
};

export const pageConfig = {
  defineValidationSchemas() {
    return {
      params: v.object({
        lang: v.string(),
        slug: v.string(),
      }),
    };
  },
} satisfies PageConfig;

type Params = InferValidateOptions<typeof pageConfig, 'params'>;

export const loader: Loader<void, Params> = ({ params, ctx }) => {
  const collection = getCollection('blogs');

  if (!collection.has(params.slug)) {
    return ctx.renderNotFound();
  }

  return ctx.render();
};

export default function Blog({ params }: PageProps<void, Params>) {
  const { Content, metadata } = getCollection('blogs').get(params.slug);

  return (
    <LayoutRow className='mt-8'>
      <div className='xl:relative'>
        <div className='mx-auto max-w-2xl'>
          <section className='mx-auto prose dark:prose-invert prose-zinc prose-img:rounded-2xl prose-figcaption:text-center prose-figcaption:text-xs prose-pre:px-0'>
            <a
              aria-label='Go to articles list'
              href={`/${params.lang}`}
              className='mb-8 flex size-10 items-center justify-center rounded-full bg-white shadow-md shadow-zinc-800/5 ring-1 ring-zinc-900/5 transition lg:absolute lg:-left-5 lg:-mt-2 lg:mb-0 xl:-top-1.5 xl:left-0 xl:mt-0 text-jade-500 hover:text-jade-600 dark:text-zinc-300 dark:hover:text-zinc-400 dark:border dark:border-zinc-700/50 dark:bg-zinc-800 dark:ring-0 dark:ring-white/10 dark:hover:border-zinc-700 dark:hover:ring-white/20'
            >
              <ArrowLeft />
            </a>
            <BlogHeroImage heroImage={metadata.heroImage} />
            <Content />
          </section>
        </div>
      </div>
    </LayoutRow>
  );
}
