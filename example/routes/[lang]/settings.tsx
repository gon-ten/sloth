import type { PageProps } from "@gdiezpa/blog/runtime";

type Params = {
  lang: string;
};

type Data = void;

export default function Settings({ data, params }: PageProps<Data, Params>) {
  const { lang } = params;
  console.log({ lang, data });
  return <div>Settings</div>;
}
