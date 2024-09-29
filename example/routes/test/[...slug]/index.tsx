import type { PageProps } from "@sloth/core/runtime";

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
