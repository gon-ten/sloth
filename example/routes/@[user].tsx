import type { PageProps } from "@gdiezpa/blog/runtime";

type Params = {
  user: string;
};

export default function Profile({ url, params }: PageProps<void, Params>) {
  return (
    <div>
      {url} = {params.user}
    </div>
  );
}
