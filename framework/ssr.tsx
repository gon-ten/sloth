import { prerender } from "preact-iso";
import type { RootModule, PostsBarrelExport } from "./types.ts";
import type { Context } from "./context.ts";

export async function renderPost(
  context: Context,
  postName: string
): Promise<{ ok: false } | { ok: true; content: string }> {
  const rawPostsBarrel = context.resolveFromOutDir("raw_posts", "index.js");
  const { default: posts }: PostsBarrelExport = await import(rawPostsBarrel);

  if (!Reflect.has(posts, postName)) {
    return { ok: false };
  }

  const { default: MDXContent } = await posts[postName]();

  const { html } = await prerender(<MDXContent />);

  const content = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${postName}</title>
        <link rel="stylesheet" href="/static/styles/styles.css" />
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

export async function render(context: Context): Promise<string> {
  const root = context.getAppRoot();
  const { default: Root }: RootModule = await import(root);
  const { html } = await prerender(<Root />);

  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Document</title>
        <link rel="stylesheet" href="/static/styles/styles.css" />
      </head>
      <body>
        <div id="root">${html}</div>
        <script src="/static/client_entry.js" type="module"></script>
      </body>
      </html>
    `;
}
