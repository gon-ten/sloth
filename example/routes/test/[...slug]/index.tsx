import type { PageProps } from '@gdiezpa/blog/runtime';

type Params = {
  slug: string;
};

export default function Slug({ params, url }: PageProps<void, Params>) {
  const { slug } = params;
  return (
    <div>
      Slug: {url} {slug}
    </div>
  );
}
