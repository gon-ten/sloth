import type { PageProps } from "@gdiezpa/blog/runtime";

type Params = {
  slug: string;
};

export default function Blog({ params }: PageProps<void, Params>) {
  const { slug } = params;
  return <div>Blog entry: {slug}</div>;
}
