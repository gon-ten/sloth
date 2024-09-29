import type { PageProps } from "@sloth/core/runtime";

type Params = {
  lang: string;
};

const flagMap: Record<string, string> = {
  es: "🇪🇸",
  us: "🇺🇸",
};

export default function Lang({ params }: PageProps<void, Params>) {
  const { lang } = params;
  return (
    <div>
      Your language is <code>{lang}</code>
      <div className="text-9xl">{flagMap[lang] ?? "️🌍"}</div>
    </div>
  );
}
