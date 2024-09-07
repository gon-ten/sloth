import type {
  PostsBarrelExport,
  ImportMapEntry,
  LoaderModule,
  PageProps,
  CollectionModule,
} from "./types.ts";
import type { FsContext } from "./fs_context.ts";
import { HYDRATION_SCRIPT_MEDIA_TYPE } from "./utils.ts";
import prerender from "preact-render-to-string";

export async function renderRoute({
  context,
  importMap,
  request,
  params: rawParams,
}: {
  context: FsContext;
  importMap: ImportMapEntry;
  request: Request;
  params?: URLPatternResult;
}): Promise<string> {
  const [{ default: Root }, { default: Route }] = await Promise.all([
    import(context.getAppRoot()),
    import(importMap.component),
  ]);

  const params: Record<string, string> = rawParams
    ? (Object.fromEntries(
        Object.entries(rawParams.pathname.groups).filter(
          ([, value]) => typeof value !== "undefined"
        )
      ) as Record<string, string>)
    : {};
  const data: Record<string, unknown> = {};
  const { default: loader }: LoaderModule = await import(importMap.loader);
  data[importMap.hash] = await loader({ request, params });

  const url = new URL(request.url);

  const pageProps: PageProps = {
    data: data[importMap.hash],
    url: url.pathname,
    params,
  };

  const html = prerender(
    <Root
      Component={() => (
        <div id="root">
          <Route {...pageProps} />
        </div>
      )}
    ></Root>
  );

  const content = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body>
        ${html}
        <script type="${HYDRATION_SCRIPT_MEDIA_TYPE}">${JSON.stringify({
    [importMap.hash]: pageProps,
  })}</script>
        <script src="/static/hydrate_${
          importMap.hash
        }.js" type="module"></script>
      </body>
    </html>
  `.replace(/^\s+/gm, "");

  return content;
}

export async function renderPost(
  context: FsContext,
  postName: string
): Promise<{ ok: false } | { ok: true; content: string }> {
  const rawPostsBarrel = context.resolveFromOutDir(
    "raw",
    "collections",
    "index.js"
  );
  const { default: posts }: PostsBarrelExport = await import(rawPostsBarrel);

  if (!Reflect.has(posts, postName)) {
    return { ok: false };
  }

  const { default: MDXContent, frontmatter } = (await posts[
    postName
  ]()) as CollectionModule;

  console.log(frontmatter);

  const { html } = await prerender(<MDXContent />);

  const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${postName}</title>
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body>
        <div id="root">${html}</div>
        <script type="module">
          import("/static/posts/hydrate.js")
            .then(module => module.default("${postName}"))
            .catch(() => null)
        </script>
      </body>
      </html>
    `;

  return { ok: true, content };
}
