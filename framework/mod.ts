import { compile } from "@mdx-js/mdx";
import { walk, exists } from "@std/fs";
import remarkFrontmatter from "remark-frontmatter";
import type {
  Manifest,
  RouteModule,
  ImportMap,
  ImportMapEntry,
  CookedFiles,
} from "./types.ts";
import { renderPost, renderRoute } from "./ssr.tsx";
import * as colors from "@std/fmt/colors";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { FsContext } from "./fs_context.ts";
import {
  basename,
  extname,
  fromFileUrl,
  join,
  relative,
  resolve,
  SEPARATOR,
  SEPARATOR_PATTERN,
  toFileUrl,
} from "@std/path";
import { contentType } from "@std/media-types";
import { type Handler, route, type Route, serveDir } from "@std/http";
import { encodeHex } from "@std/encoding/hex";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { collectionsMap } from "./collections_map.ts";

function createRoutes(context: FsContext): Route[] {
  const cookedPath = context.resolveFromOutDir("static");
  return [
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/favicon.ico" }),
      handler: notFound,
    },
    {
      method: "GET",
      pattern: new URLPattern({ pathname: "/static/*" }),
      handler: (req) =>
        serveDir(req, {
          fsRoot: cookedPath,
          urlRoot: "static/",
          showIndex: false,
        }),
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

const __dirname = fromFileUrl(new URL(".", import.meta.url));

const textEncoder = new TextEncoder();

const DEFAULT_PORT = 3443;

function resolveInCurrentScope(...segments: string[]): string {
  return resolve(__dirname, ...segments);
}

async function createDirectoryIfNotExists(path: string) {
  const dirExists = await exists(path);
  if (dirExists) {
    return;
  }
  await Deno.mkdir(path + "/", { recursive: true });
}

async function bundleAssets(context: FsContext) {
  await Promise.all([
    bundleStyles(context),
    bundleCollections(context),
    copyPublicFiles(context),
  ]);
}

async function copyPublicFiles(context: FsContext): Promise<void> {
  const publicDir = context.resolvePath("public");
  const publicDirExits = await exists(publicDir);

  if (!publicDirExits) {
    return;
  }

  const outDir = context.resolveFromOutDir("static");

  for await (const file of walk(publicDir, { includeDirs: false })) {
    const relativePath = relative(publicDir, file.path);
    const outDirDir = join(outDir, relativePath.slice(0, -file.name.length));
    await Deno.mkdir(outDirDir, {
      recursive: true,
    });
    await Deno.copyFile(file.path, resolve(outDir, relativePath));
  }
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

export async function start(manifest: Manifest) {
  const context = new FsContext(manifest);
  const outDir = context.resolveFromOutDir(".");
  await Deno.remove(outDir, { recursive: true }).catch(() => null);
  await Deno.mkdir(outDir, { recursive: true }).catch(() => null);
  const { routes, defaultHandler } = await buildRoutes(context);
  await bundleAssets(context);
  initServer({ context, routes, defaultHandler });
}

async function bundleStyles(context: FsContext) {
  const tailwindConfigPath = context.resolvePath("tailwind.config.js");
  const outFile = context.resolveFromOutDir("static", "styles.css");
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
    stdout: "piped",
    stderr: "piped",
  });

  const cp = cssCmd.spawn();
  const { success, stderr } = await cp.output();

  if (!success) {
    console.warn(
      colors.red(`⨯ CSS bundling process failed. Reason:`),
      new TextDecoder().decode(stderr)
    );
  } else {
    console.log(colors.green(`✔️ CSS bundling process succeeded`));
  }
}

async function bundleCollections(fsContext: FsContext): Promise<void> {
  const collectionsDir = fsContext.resolvePath("collections");
  const postsDirExists = await exists(collectionsDir);
  if (!postsDirExists) {
    console.warn(
      `📜 Posts directory not found. Expected to be located at ${collectionsDir}`
    );
    return;
  }
  const rawCollectionsDir = fsContext.resolveFromOutDir("raw", "collections");
  await createDirectoryIfNotExists(rawCollectionsDir);
  let tmpPaths: string[] = [];
  const collections: Record<string, string[]> = {};
  for await (const file of walk(collectionsDir, {
    includeDirs: false,
    match: [/.mdx$/],
  })) {
    const buffer = await Deno.readFile(file.path);
    const baseUrl = file.path.slice(0, -basename(file.path).length);
    const result = await compile(buffer, {
      outputFormat: "program",
      jsxImportSource: "preact",
      // deno-lint-ignore no-explicit-any
      remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter as any],
      baseUrl: toFileUrl(baseUrl),
    });

    const ext = extname(file.name);
    const collectionName = file.name.slice(0, -ext.length);
    const collectionPathPrefix = relative(collectionsDir, file.path).slice(
      0,
      -file.name.length
    );

    const collectionDstDir = join(rawCollectionsDir, collectionPathPrefix);
    const collectionDstPath = join(collectionDstDir, collectionName + ".jsx");

    await createDirectoryIfNotExists(collectionDstDir);

    const fileContent =
      typeof result.value === "string"
        ? textEncoder.encode(result.value)
        : result.value;
    await Deno.writeFile(collectionDstPath, fileContent, { createNew: true });

    const collectionGetterName = collectionPathPrefix
      .split(SEPARATOR)
      .filter(Boolean)
      .join(SEPARATOR);
    collections[collectionGetterName] ??= [];
    collections[collectionGetterName].push(collectionName);

    tmpPaths = tmpPaths.concat(toFileUrl(collectionDstPath).href);
  }

  // FIXME
  Object.entries(collections).map(([key, value]) => {
    collectionsMap.set(
      key,
      Object.fromEntries(value.map((name) => [name, {}]))
    );
  });

  const generatedTypesFilePath = resolveInCurrentScope(
    "./generated/generated.ts"
  );

  await Deno.writeTextFile(
    generatedTypesFilePath,
    `// THIS FILE IS AUTO GENERATED AND WILL BE OVERRIDEN FRECUENTLY. DO NOT MODIFY IT.
    export type CollectionEntry = {
      frontMatter: Record<string, string>
    };
    
    export type CollectionsMap = { ${Object.entries(collections)
      .map(
        ([key, value]) =>
          `"${key}": { ${value
            .map((c) => `"${c}": CollectionEntry`)
            .join(",")} }`
      )
      .join(",")} }
    `
  );

  const postsBarrelFilePath = resolve(rawCollectionsDir, "index.js");
  const postsBarrelFileContent = `
    const posts = {
        ${tmpPaths
          .map((tmpPath) => `"${tmpPath}": () => import("${tmpPath}")`)
          .join(",")}
    }
  
    export default posts
  `;

  const hydratePostContentFilePath = resolve(rawCollectionsDir, "hydrate.jsx");
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

  await Promise.all([
    Deno.writeTextFile(postsBarrelFilePath, postsBarrelFileContent),
    Deno.writeTextFile(hydratePostContentFilePath, hydratePostContent),
  ]);

  formatFiles({
    entryFiles: [
      postsBarrelFilePath,
      hydratePostContentFilePath,
      generatedTypesFilePath,
    ],
    target: "Collections Files",
  });

  const outDir = fsContext.resolveFromOutDir("static", "./posts");
  await createDirectoryIfNotExists(outDir);

  await bundleClient({
    paths: [postsBarrelFilePath, hydratePostContentFilePath],
    outDir,
    fsContext,
  });
}

async function formatFiles({
  entryFiles,
  target,
}: {
  entryFiles: string[];
  target: string;
}) {
  const fmtCmd = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "-q", ...entryFiles],
    stderr: "piped",
    stdout: "null",
  });
  const cp = fmtCmd.spawn();
  const { success, stderr } = await cp.output();
  console.log(
    success
      ? colors.green(`✔️ ${target}: output files formatted correctly.`)
      : colors.red(
          `⨯ ${target} there was an error during file formatting. ${stderr}`
        )
  );
}

async function bundleClient({
  paths,
  define = {},
  outDir,
  plugins = [],
  fsContext,
}: {
  paths: string[];
  outDir: string;
  fsContext: FsContext;
  define?: Record<string, string>;
  plugins?: esbuild.Plugin[];
}): Promise<CookedFiles> {
  await createDirectoryIfNotExists(outDir);

  const result = await esbuild.build({
    plugins: [
      ...plugins,
      ...denoPlugins({
        configPath: fsContext.resolvePath("./deno.json"),
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
    jsxImportSource: "preact",
    define: {
      ...define,
    },
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
  defaultHandler,
}: {
  context: FsContext;
  routes: Route[];
  defaultHandler: Handler;
}): void {
  console.log(colors.bgBrightBlue("initializing server"));

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
    route([...createRoutes(context), ...routes], defaultHandler)
  );
}

function createRouteHandlersFromRouteModule({
  context,
  routeMatch,
  importMap,
}: {
  context: FsContext;
  routeMatch: string;
  importMap: ImportMapEntry;
}): Route[] {
  const pattern = new URLPattern({ pathname: routeMatch });
  return [
    {
      method: "GET",
      pattern,
      async handler(req, _, params) {
        const html = await renderRoute({
          context,
          importMap,
          request: req,
          params: params ?? undefined,
        });

        const res = new Response(html, {
          headers: {
            "content-type": contentType("html"),
          },
        });

        return res;
      },
    },
  ];
}

function createHash() {
  return encodeHex(crypto.getRandomValues(new Uint8Array(10)));
}

async function splitRouteIntoFiles({
  filePath,
  context,
}: {
  filePath: string;
  context: FsContext;
}): Promise<ImportMapEntry> {
  const { loader }: RouteModule = await import(filePath);

  const hash = createHash();
  const srcDir = context.resolvePath("routes");
  const outDir = context.resolveFromOutDir("raw", "ssr");
  const ext = extname(filePath);
  const filePathWithoutExt = filePath.slice(0, -ext.length);
  const sluggedRelativePath = relative(srcDir, filePathWithoutExt).replaceAll(
    SEPARATOR,
    "_"
  );

  const srcFileUrlPath = toFileUrl(filePath).href;
  const exportComponentFilePath = join(
    outDir,
    `export_${sluggedRelativePath}_${hash}.tsx`
  );
  const exportComponentFileContent = `
    import { default as Page } from "${srcFileUrlPath}";
    export default Page;
  `;

  const loaderFilePath = join(
    outDir,
    `loader_${sluggedRelativePath}_${hash}.ts`
  );
  const loaderFileContent =
    typeof loader === "function"
      ? `export { loader as default } from "${srcFileUrlPath}";`
      : `export default () => undefined`;

  const setupClientPath = resolveInCurrentScope("./setup_client.tsx");
  const hydrationFilePath = join(outDir, `hydrate_${hash}.tsx`);
  const hydrationFileContent = `
    import { setupClient } from "${setupClientPath}";

    (async () => {
      const { default: Page } = await import("${exportComponentFilePath}");
      setupClient(Page, "${hash}");
    })();
  `;

  await Promise.all([
    Deno.writeTextFile(exportComponentFilePath, exportComponentFileContent),
    Deno.writeTextFile(loaderFilePath, loaderFileContent),
    Deno.writeTextFile(hydrationFilePath, hydrationFileContent),
  ]);

  return {
    component: exportComponentFilePath,
    hydration: hydrationFilePath,
    loader: loaderFilePath,
    hash,
  };
}

async function buildRoutes(
  context: FsContext
): Promise<{ defaultHandler: Handler; routes: Route[] }> {
  const routesDir = context.resolvePath("routes");
  let routes: Route[] = [];

  const rawSsrDir = context.resolveFromOutDir("raw", "ssr");
  await createDirectoryIfNotExists(rawSsrDir);

  const importMap: ImportMap = {};

  for await (const file of walk(routesDir, {
    includeDirs: false,
    includeSymlinks: false,
    match: [/\.tsx$/],
  })) {
    const routesDir = context.resolvePath("./routes");
    const { pattern: routeMatch } = createRoutePatternFromRelativePath(
      relative(routesDir, file.path)
    );

    const { component, loader, hash, hydration } = await splitRouteIntoFiles({
      context,
      filePath: file.path,
    });

    const importMapEntry: ImportMapEntry = {
      hash,
      component,
      loader,
      hydration,
    };

    importMap[file.path] = importMapEntry;

    const moduleRoutes = createRouteHandlersFromRouteModule({
      context,
      importMap: importMapEntry,
      routeMatch,
    });

    routes = routes.concat(moduleRoutes);
  }

  await Promise.all([
    Deno.writeTextFile(
      join(rawSsrDir, "import_map.json"),
      JSON.stringify(importMap, null, 2)
    ),
  ]);

  formatFiles({
    target: "Route Files",
    entryFiles: Object.values(importMap).flatMap((entry) =>
      Object.values(entry)
    ),
  });

  const clientBuildOutDir = context.resolveFromOutDir("static");
  await createDirectoryIfNotExists(clientBuildOutDir);

  await bundleClient({
    fsContext: context,
    paths: [...Object.values(importMap).flatMap((entry) => entry.hydration)],
    outDir: clientBuildOutDir,
    plugins: [
      overrideImportPath({
        filter: /\@gdiezpa\/blog\/runtime/,
        replaceWithPath: fromFileUrl(
          new URL("./client_runtime.ts", import.meta.url).href
        ),
        debug: true,
      }),
    ],
  });

  return {
    routes,
    defaultHandler: notFound,
  };
}

function createRoutePatternFromRelativePath(routePath: string): {
  pattern: string;
  segments: string[];
} {
  const parts = routePath
    .slice(0, -extname(routePath).length)
    .split(SEPARATOR_PATTERN);

  for (const [index, part] of parts.entries()) {
    if (index === parts.length - 1) {
      if (["index"].includes(part)) {
        parts.splice(index);
        break;
      }
    }

    const singleParamMatch = /^\[+(?<paramName>[0-9A-Za-z-_]+)\]$/i.exec(part);

    if (singleParamMatch !== null) {
      const paramName = singleParamMatch.groups?.paramName;
      parts[index] = `:${paramName}`;
      continue;
    }

    const catchAllMatch = /^\[\.{3}(?<paramName>[0-9A-Za-z-_']+)\]$/i.exec(
      part
    );

    if (catchAllMatch) {
      const paramName = catchAllMatch.groups?.paramName;
      parts[index] = `:${paramName}*`;
      parts.splice(index + 1);
      break;
    }
  }

  return {
    pattern: "/" + parts.join("/"),
    segments: [...parts, basename(routePath)],
  };
}

const overrideImportPath = (opts: {
  filter: RegExp;
  replaceWithPath: string;
  debug?: boolean;
}): esbuild.Plugin => {
  return {
    name: "override-import-map-plugin",
    setup(builder) {
      builder.onResolve({ filter: opts.filter }, (args) => {
        if (opts.debug) {
          console.log(
            colors.bold("\nOverride import path plugin:\n\n") +
              colors.underline(`${args.importer}\n\n`) +
              colors.red(`[-] ${args.path}\n`) +
              colors.brightGreen(`[+] ${opts.replaceWithPath}\n`)
          );
        }
        return {
          path: opts.replaceWithPath,
        };
      });
    },
  };
};
