import type { PageProps } from "@sloth/core/runtime";

type Params = {
  lang: string;
};

type Data = void;

export default function Settings({ data, params }: PageProps<Data, Params>) {
  return <div onClick={alert}>Settings</div>;
}
