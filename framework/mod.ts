import { compile } from "@mdx-js/mdx";
import rehypeHighlight from "rehype-highlight";
import { walk, exists } from "@std/fs";
import type { Manifest } from "./types.ts";
import { render, renderPost } from "./ssr.tsx";
import * as colors from "@std/fmt/colors";
import * as esbuild from "https://deno.land/x/esbuild@v0.23.1/wasm.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";
import { Context } from "./context.ts";
import { basename, extname, fromFileUrl, resolve, toFileUrl } from "@std/path";
import { contentType } from "@std/media-types";
import { toReadableStream } from "@std/io";

const textEncoder = new TextEncoder();
const __dirname = fromFileUrl(new URL(".", import.meta.url));

const { default: denoJson } = await import("./deno.json", {
  with: {
    type: "json",
  },
});

const DEFAULT_PORT = 3443;

function resolveInCurrentScope(...segments: string[]): string {
  return resolve(__dirname, ...segments);
}

async function createDirectoryIfNotExists(path: string) {
  const dirExists = await exists(path);
  if (dirExists) {
    return;
  }
  await Deno.mkdir(path + "/");
}

async function bundleApp(context: Context) {
  const outDir = context.resolveFromOutDir(".");
  await Deno.remove(outDir, { recursive: true }).catch(() => null);
  await Deno.mkdir(outDir, { recursive: true }).catch(() => null);
  await Promise.all([
    bundleAppRoot(context),
    bundleStyles(context),
    bundlePosts(context),
  ]);
}

function internalServerError(): Response {
  return new Response("Internal Server Error", {
    status: 500,
    statusText: "Internal Server Error",
    headers: {
      "content-type": "text/plain",
    },
  });
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    statusText: "Not Found",
    headers: {
      "content-type": "text/plain",
    },
  });
}

async function serveStatic(context: Context, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookedPath = context.resolveFromOutDir(url.pathname.slice(1));

  try {
    const fileInfo = await Deno.stat(cookedPath);
    let bodyInit: BodyInit | null = null;
    if (fileInfo.size > 1024 * 5) {
      bodyInit = toReadableStream(await Deno.open(cookedPath));
    } else {
      bodyInit = await Deno.readFile(cookedPath);
    }
    return new Response(bodyInit, {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type":
          contentType(extname(cookedPath)) ?? "application/octect-stream",
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return notFound();
    }
    return internalServerError();
  }
}

export async function start(manifest: Manifest) {
  const context = new Context(manifest);
  await bundleApp(context);
  initServer(async (req) => {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/static")) {
      return serveStatic(context, req);
    }

    if (url.pathname === "/favicon.ico") {
      return notFound();
    }

    if (url.pathname.startsWith("/posts")) {
      const [, postName] = url.pathname.slice("/posts".length).split("/");

      const result = await renderPost(context, postName);

      if (!result.ok) {
        return notFound();
      }

      return new Response(result.content, {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "text/html",
        },
      });
    }

    const html = await render(context);

    return new Response(html, {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "text/html",
      },
    });
  });
}

class HttpResponseError extends Error {
  public readonly name = "HttpResponseError";
  constructor(public readonly cause: unknown) {
    super();
  }
}

async function bundleAppRoot(context: Context) {
  const rootImportPath = context.getAppRoot();

  await bundle({
    paths: [resolveInCurrentScope("./client_entry.tsx")],
    outDir: context.resolveFromOutDir("static"),
    define: {
      "import.meta.env.ROOT_ENTRY": `"${rootImportPath}"`,
    },
  });
}

function bundleStyles(context: Context) {
  const tailwindConfigPath = context.resolvePath("tailwind.config.js");
  const outFile = context.resolveFromOutDir("static", "styles", "styles.css");
  const cssCmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-ffi",
      "--allow-sys",
      "--allow-env",
      "--allow-write",
      "--allow-read",
      "npm:tailwindcss",
      "-c",
      tailwindConfigPath,
      "-o",
      outFile,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  cssCmd.spawn();
}

async function bundlePosts(context: Context): Promise<void> {
  const postsDir = context.resolvePath("./posts");
  const postsDirExists = await exists(postsDir);
  if (!postsDirExists) {
    console.warn(
      `📜 Posts directory not found. Expected to be located at ${postsDir}`
    );
    return;
  }
  const rawPostsDir = context.resolveFromOutDir("raw_posts");
  await createDirectoryIfNotExists(rawPostsDir);
  let tmpPaths: string[] = [];
  for await (const post of walk(postsDir, {
    includeDirs: false,
    match: [/.mdx$/],
  })) {
    const buffer = await Deno.readFile(post.path);
    const result = await compile(buffer, {
      outputFormat: "program",
      jsxImportSource: "preact",
      rehypePlugins: [rehypeHighlight],
      baseUrl: toFileUrl(postsDir + "/"),
    });
    const dstName = post.name.replace(/.mdx$/, ".jsx");
    const dstPath = resolve(rawPostsDir, dstName);
    await Deno.writeFile(
      dstPath,
      result.value instanceof Uint8Array
        ? result.value
        : textEncoder.encode(result.value)
    );
    tmpPaths = tmpPaths.concat(dstPath);
  }

  const postsBarrelFilePath = resolve(rawPostsDir, "index.js");
  const postsBarrelFileContent = `
    const posts = {
        ${tmpPaths
          .map(
            (tmpPath) =>
              `"${basename(tmpPath).slice(
                0,
                -extname(tmpPath).length
              )}": () => import("./${basename(tmpPath)}")`
          )
          .join(",")}
    }
  
    export default posts
  `;

  const hydratePostContentFilePath = resolve(rawPostsDir, "hydrate.jsx");
  const hydratePostContent = `
    import { hydrate } from "preact-iso";
    import { default as posts } from "./index.js";
    
    export default async function boot(postName) {
      try {
        const { default: MDXContent } = await posts[postName]();
        hydrate(<MDXContent />, document.querySelector("root"));
      } catch {
        // do nothing yet
      }
    }
  `;

  await Deno.writeFile(
    postsBarrelFilePath,
    textEncoder.encode(postsBarrelFileContent)
  );
  await Deno.writeFile(
    hydratePostContentFilePath,
    textEncoder.encode(hydratePostContent)
  );

  const fmtCmd = new Deno.Command(Deno.execPath(), {
    args: ["fmt", postsBarrelFilePath, hydratePostContentFilePath],
  });
  fmtCmd.spawn();

  const outDir = context.resolveFromOutDir("static", "./posts");
  await createDirectoryIfNotExists(outDir);

  await bundle({
    paths: [postsBarrelFilePath, hydratePostContentFilePath],
    outDir,
  });
}

type CookedFiles = string[];

async function bundle({
  paths,
  define = {},
  outDir,
  plugins = [],
}: {
  paths: string[];
  outDir: string;
  define?: Record<string, string>;
  plugins?: esbuild.Plugin[];
}): Promise<CookedFiles> {
  await createDirectoryIfNotExists(outDir);

  const result = await esbuild.build({
    plugins: [
      ...plugins,
      ...denoPlugins({
        configPath: resolveInCurrentScope("./deno.json"),
      }),
    ],
    sourcemap: true,
    entryPoints: paths,
    outdir: outDir,
    minify: Deno.env.get("ENV") === "production",
    bundle: true,
    treeShaking: true,
    legalComments: "none",
    splitting: true,
    target: "es2022",
    format: "esm",
    jsx: "automatic",
    jsxImportSource: denoJson.compilerOptions.jsxImportSource,
    define,
  });

  const { outputFiles = [] } = result;

  for (const outfile of outputFiles) {
    await Deno.writeFile(outfile.path, outfile.contents, {
      createNew: true,
    });
  }

  esbuild.stop();

  return outputFiles.map(({ path }) => path);
}

function initServer(handler: (req: Request) => Response | Promise<Response>) {
  const onListen: Deno.ServeOptions["onListen"] = (addr) => {
    const fullAddr = colors.cyan(`http://localhost:${addr.port}`);
    console.log(`\n\t🦥 Sloth Server running at ${fullAddr}\n`);
  };

  const onError: Deno.ServeOptions["onError"] = (error) => {
    console.log(`\n${colors.red("An error ocurred:")}\n\n`);
    console.log(error);
    return internalServerError();
  };

  Deno.serve(
    {
      port: Deno.env.has("PORT") ? +Deno.env.get("PORT")! : DEFAULT_PORT,
      onListen,
      onError,
    },
    (req) => {
      try {
        return handler(req);
      } catch (cause) {
        throw new HttpResponseError(cause);
      }
    }
  );
}
