import type { PageProps } from "@gdiezpa/blog/runtime";

type Params = {
  lang: string;
};

type Data = void;

export default function Settings({ data, params }: PageProps<Data, Params>) {
  return <div onClick={alert}>Settings</div>;
}
