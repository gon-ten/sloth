import {
  getCollection,
  type PageProps,
  type RouteConfig,
} from "@sloth/core/runtime";
import { useRef } from "preact/hooks";

export const config: RouteConfig = {
  skipInheritedLayouts: true,
};

type Params = {
  slug: string;
};

export default function Blog({ params }: PageProps<void, Params>) {
  const { Content } = getCollection("blogs").get(params.slug);

  const headerRef = useRef<HTMLHeadElement>(null);

  return (
    <div className="mx-auto prose prose-img:rounded-xl prose-a:no-underline prose-a:text-blue-500 prose-pre:px-0">
      <header ref={headerRef} id="top" className="mb-4">
        <nav className="h-14 flex items-center">
          <a href="/blog">← All blogs</a>
        </nav>
      </header>
      <Content />
      <div>
        <button
          onClick={() =>
            headerRef.current?.scrollIntoView({ behavior: "smooth" })
          }
        >
          Back to top
        </button>
      </div>
    </div>
  );
}
