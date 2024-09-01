import { compile } from "@mdx-js/mdx";
import rehypeHighlight from "rehype-highlight";
import { walk, exists } from "@std/fs";
import {
  type HttpMethod,
  httpMethods,
  type Manifest,
  type RouteHandler,
  type RouteModule,
} from "./types.ts";
import { render, renderPost } from "./ssr.tsx";
import * as colors from "@std/fmt/colors";
import * as esbuild from "https://deno.land/x/esbuild@v0.23.1/wasm.js";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";
import { Context } from "./context.ts";
import {
  basename,
  extname,
  fromFileUrl,
  relative,
  resolve,
  toFileUrl,
} from "@std/path";
import { contentType } from "@std/media-types";
import { toReadableStream } from "@std/io";
import { route, type Route } from "@std/http";

export { type RouteHandlers, type RouteHandler } from "./types.ts";

function createRoutes(context: Context): Route[] {
  return [
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/favicon.ico" }),
      handler: notFound,
    },
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/static/*" }),
      handler(req) {
        return serveStatic(context, req);
      },
    },
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/posts/:id" }),
      async handler(_req, _info, params) {
        if (!params?.pathname.groups.id) {
          return notFound();
        }

        const result = await renderPost(context, params.pathname.groups.id);

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
      },
    },
  ];
}

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
  const [, routes] = await Promise.all([
    bundleApp(context),
    walkRoutes(context),
  ]);
  initServer({ context, routes });
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

function initServer({
  context,
  routes,
}: {
  context: Context;
  routes: Route[];
}): void {
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
    route([...createRoutes(context), ...routes], async () => {
      const html = await render(context);
      return new Response(html, {
        status: 200,
        statusText: "OK",
        headers: {
          "content-type": "text/html",
        },
      });
    })
  );
}

class InvalidRouteModuleError extends Error {
  constructor(public readonly modulePath: string) {
    super(
      `No default export or default export is not a function at ${modulePath}`
    );
  }
}

async function createRouteHandlersFromRouteModule({
  modulePath,
  routeMatch,
}: {
  modulePath: string;
  routeMatch: string;
}): Promise<Route[]> {
  const { default: PageComponent, handlers }: RouteModule = await import(
    modulePath
  );

  if (typeof PageComponent !== "function") {
    throw new InvalidRouteModuleError(modulePath);
  }

  const { GET: getHandler, ...otherHandlers } = handlers ?? {};

  const handledMethods = Object.entries(otherHandlers).filter(
    ([method, handler]) => {
      const isValidHttpMethod = httpMethods.includes(method as HttpMethod);

      if (isValidHttpMethod && typeof handler !== "function") {
        console.log(
          colors.yellow(
            `Ignored handler for method ${method} because the given value is not a function at ${modulePath}`
          )
        );

        return false;
      }

      return isValidHttpMethod;
    }
  );

  const pattern = new URLPattern({ pathname: routeMatch });

  return [
    {
      method: "GET",
      pattern,
      async handler(req) {
        let handlerResult: ReturnType<RouteHandler> = undefined;
        if (getHandler) {
          handlerResult = await Promise.resolve(getHandler(req));
          if (handlerResult instanceof Response) {
            return handlerResult;
          }
        }
        return Response.json({
          modulePath,
        });
      },
    },
    ...handledMethods.map(([method, handler]): Route => {
      return {
        method,
        pattern,
        async handler(req) {
          let handlerResult: ReturnType<RouteHandler> = undefined;
          handlerResult = await Promise.resolve(handler(req));
          if (handlerResult instanceof Response) {
            return handlerResult;
          }
          return Response.json({
            modulePath,
          });
        },
      };
    }),
  ];
}

async function walkRoutes(context: Context): Promise<Route[]> {
  const routesDir = context.resolvePath("routes");
  let routes: Route[] = [];
  for await (const file of walk(routesDir, {
    includeDirs: false,
    includeSymlinks: false,
    match: [/\.tsx$/],
  })) {
    const routeMatch = createRoutePatternFromRelativePath(
      relative(context.resolvePath("routes"), file.path)
    );

    try {
      const moduleRoutes = await createRouteHandlersFromRouteModule({
        modulePath: file.path,
        routeMatch,
      });
      routes = routes.concat(moduleRoutes);
    } catch (error) {
      if (error instanceof InvalidRouteModuleError) {
        console.warn(colors.yellow(error.message));
        continue;
      } else {
        console.error(
          colors.red(`Unexpected error while importing ${file.path} module`),
          error
        );
      }
    }
  }

  return routes;
}

function createRoutePatternFromRelativePath(routePath: string) {
  const parts = routePath.slice(0, -extname(routePath).length).split("/");

  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      if (["index"].includes(part)) {
        parts.splice(index);
        break;
      }
    }

    const singleParamsMatch = /^\[+(?<paramName>[0-9A-Za-z-_]+)\]$/i.exec(part);
    if (singleParamsMatch !== null) {
      const paramName = singleParamsMatch.groups?.paramName;
      parts[index] = `:${paramName}`;
      continue;
    }
    const catchAllMatch = /^\[\.{3}(?<paramName>[0-9A-Za-z-_']+)\]$/i.exec(
      part
    );
    if (catchAllMatch) {
      parts[index] = "*";
      parts.splice(index + 1);
      break;
    }
  }

  return "/" + parts.join("/");
}
