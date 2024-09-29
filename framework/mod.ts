import { walk, exists } from "@std/fs";
import type {
  Manifest,
  RouteModule,
  RouteImportMapEntry,
  CookedFiles,
  RelativePath,
  Interceptors,
  FileName,
  AbsolutePath,
} from "./types.ts";
import { renderRoute } from "./server/render_route.tsx";
import * as colors from "@std/fmt/colors";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { FsContext } from "./server/fs_context.ts";
import {
  fromFileUrl,
  join,
  relative,
  resolve,
  SEPARATOR,
  SEPARATOR_PATTERN,
} from "@std/path";
import { type Route } from "@std/http";
import { encodeHex } from "@std/encoding";
import { notFound } from "./server/http_responses.ts";
import { initServer } from "./server/init_server.ts";
import { LAYOUT_FILE_NAME, MIDDLEWARE_FILE_NAME } from "./shared/constants.ts";
import { createDirectoryIfNotExists, fileNameWithNoExt } from "./utils/fs.ts";
import { formatFiles } from "./utils/fmt.ts";
import { compile as compileCollections } from "./collections/compile.ts";
import { bundleStyles } from "./styling/bundle_styles.ts";

function resolveInCurrentScope(...segments: string[]): string {
  return resolve(fromFileUrl(new URL(".", import.meta.url)), ...segments);
}

async function bundleAssets(context: FsContext) {
  await Promise.all([bundleStyles(context), copyPublicFiles(context)]);
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

export async function start(manifest: Manifest) {
  const fsContext = new FsContext(manifest);
  const outDir = fsContext.resolveFromOutDir(".");
  await Deno.remove(outDir, { recursive: true }).catch(() => null);
  await Deno.mkdir(outDir, { recursive: true }).catch(() => null);

  const { filesToBundle: postsToBundle } = await compileCollections(fsContext);
  const { routes, filesToBundle: clientFilesToBundle } = await buildRoutes(
    fsContext
  );

  const clientBuildOutDir = fsContext.resolveFromOutDir("static");

  await bundleClient({
    fsContext: fsContext,
    paths: [...clientFilesToBundle, ...postsToBundle],
    outDir: clientBuildOutDir,
    plugins: [
      // Replace runtime with browser/runtime
      overrideImportPath({
        filter: /\@sloth\/core\/runtime/,
        replaceWithPath: fromFileUrl(
          new URL("./browser/runtime.ts", import.meta.url).href
        ),
        debug: false,
      }),
      // Replace collection_map with browser/collection_map
      overrideImportPath({
        filter: /collections_map\.ts/,
        replaceWithPath: fromFileUrl(
          new URL("./browser/collections_map.ts", import.meta.url).href
        ),
        debug: false,
      }),
    ],
  });
  await bundleAssets(fsContext);
  initServer({ fsContext, routes, defaultHandler: notFound });
}

async function bundleClient({
  paths,
  define = {},
  outDir,
  plugins = [],
  fsContext,
  alias,
}: {
  paths: string[];
  outDir: string;
  fsContext: FsContext;
  define?: Record<string, string>;
  plugins?: esbuild.Plugin[];
  alias?: Record<string, string>;
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
    keepNames: false,
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
    alias,
    entryNames: "[name]",
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

function createRouteHandlersFromRouteModule({
  context,
  routeMatch,
  importMap,
}: {
  context: FsContext;
  routeMatch: string;
  importMap: RouteImportMapEntry;
}): Route {
  return {
    method: "GET",
    pattern: new URLPattern({ pathname: routeMatch }),
    handler(req, _, params) {
      return renderRoute({
        context,
        importMap,
        request: req,
        params: params ?? undefined,
      });
    },
  };
}

function createHash(length = 10) {
  return encodeHex(crypto.getRandomValues(new Uint8Array(length)));
}

function slugifyPath(path: string): string {
  return path.replaceAll(SEPARATOR, "_");
}

async function splitRouteModuleIntoFiles({
  routeFileAbsPath,
  context,
  interceptors,
}: {
  routeFileAbsPath: string;
  context: FsContext;
  interceptors: Interceptors[];
}): Promise<
  Omit<RouteImportMapEntry, "interceptors" | "layouts" | "middlewares">
> {
  const { loader, metadata, config }: RouteModule = await import(
    routeFileAbsPath
  );

  const hash = createHash();
  const srcDir = context.resolvePath("routes");
  const outDir = context.resolveFromOutDir("raw", "routes");
  const filePathWithoutExt = fileNameWithNoExt(routeFileAbsPath);
  const sluggedRelativePath = slugifyPath(relative(srcDir, filePathWithoutExt));

  const writePromises: Array<Promise<void>> = [];

  const componentFilePath = join(
    outDir,
    `component_${sluggedRelativePath}_${hash}.tsx`
  );
  const exportComponentFileContent = `
    export { default, ${config ? "config" : ""} } from "${routeFileAbsPath}";
  `;

  writePromises.push(
    Deno.writeTextFile(componentFilePath, exportComponentFileContent)
  );

  let loaderFilePath: string | undefined;

  if (typeof loader === "function") {
    loaderFilePath = join(outDir, `loader_${sluggedRelativePath}_${hash}.ts`);
    writePromises.push(
      Deno.writeTextFile(
        loaderFilePath,
        `export { loader as default } from "${routeFileAbsPath}";`
      )
    );
  }

  let metadataFilePath: string | undefined;

  if (typeof metadata !== "undefined") {
    metadataFilePath = join(
      outDir,
      `metadata_${sluggedRelativePath}_${hash}.ts`
    );
    writePromises.push(
      Deno.writeTextFile(
        metadataFilePath,
        `export { metadata as default } from "${routeFileAbsPath}";`
      )
    );
  }

  const layouts = interceptors
    .filter(({ layout }) => Boolean(layout))
    .map(({ hash, layout }) => ({ hash, importPath: layout! }));

  const bootstrapMod = resolveInCurrentScope("./browser/bootstrap.tsx");
  const hydrationFilePath = join(outDir, `hydrate_${hash}.tsx`);
  const hydrationFileContent = `
    import { bootstrap } from "${bootstrapMod}";
    
    ${
      config?.skipInheritedLayouts
        ? ""
        : layouts
            .map(
              (layout, index) =>
                `import { default as Layout$${index} } from "${layout.importPath}";`
            )
            .join("\n")
    }

    const layouts = ${
      config?.skipInheritedLayouts
        ? "[]"
        : `[
              ${interceptors
                .map(
                  (layout, index) =>
                    `{ Layout: Layout$${index}, hash: "${layout.hash}" }`
                )
                .join(",")}
            ]`
    };

    (async () => {
      try {
        const { default: Page } = await import("${componentFilePath}");
        bootstrap({ Page, hash: "${hash}", layouts });
      } catch (error) {
        console.log(error)
        console.error(
          "There was an error during the hydration proccess", error
        )
      }
    })();
  `;

  writePromises.push(
    Deno.writeTextFile(hydrationFilePath, hydrationFileContent)
  );

  await Promise.all(writePromises);

  return {
    component: componentFilePath,
    hydration: hydrationFilePath,
    loader: loaderFilePath,
    metadata: metadataFilePath,
    hash,
  };
}

const wellKnownFileNames = new Set([MIDDLEWARE_FILE_NAME, LAYOUT_FILE_NAME]);

async function buildRoutes(
  context: FsContext
): Promise<{ routes: Route[]; filesToBundle: string[] }> {
  const rawSsrDir = context.resolveFromOutDir("raw", "routes");
  const clientBuildOutDir = context.resolveFromOutDir("static");

  await Promise.all([
    createDirectoryIfNotExists(rawSsrDir),
    createDirectoryIfNotExists(clientBuildOutDir),
  ]);

  const routesDir = context.resolvePath("routes");

  const routes: Route[] = [];
  const interceptors: Map<RelativePath, Interceptors> = new Map();
  const routeFiles: Map<RelativePath, Set<FileName>> = new Map();
  const filesToFormat: AbsolutePath[] = [];
  const filesToBundle: AbsolutePath[] = [];

  for await (const entry of walk(routesDir, {
    includeDirs: false,
    includeSymlinks: false,
    match: [/\.(j|t)s(x?)$/],
  })) {
    let relativePath = relative(
      routesDir,
      entry.path.slice(0, -entry.name.length)
    );

    if (relativePath.length === 0) {
      relativePath = ".";
    } else {
      relativePath = `.${SEPARATOR}${relativePath}`;
    }

    if (wellKnownFileNames.has(entry.name)) {
      if (!interceptors.has(relativePath)) {
        interceptors.set(relativePath, { hash: createHash() });
      }
      if (entry.name === LAYOUT_FILE_NAME) {
        interceptors.get(relativePath)!.layout = entry.path;
      } else if (entry.name === MIDDLEWARE_FILE_NAME) {
        interceptors.get(relativePath)!.middleware = entry.path;
      }
    } else {
      if (!routeFiles.has(relativePath)) {
        routeFiles.set(relativePath, new Set());
      }
      routeFiles.get(relativePath)!.add(entry.name);
    }
  }

  for (const [basePath, entryPoints] of routeFiles) {
    const parts = basePath.split(SEPARATOR);
    const routeInterceptors: Interceptors[] = [];

    let acc = "";
    for (const part of parts) {
      acc += part;
      if (interceptors.has(acc)) {
        const { hash, layout, middleware } = interceptors.get(acc)!;
        if (!middleware && !layout) {
          continue;
        }
        routeInterceptors.push({ hash, middleware, layout });
      }
      acc += SEPARATOR;
    }

    for (const entryPoint of entryPoints) {
      const routeMatch = fsPathToRoutePattern(join(basePath, entryPoint));

      const { component, loader, hash, hydration, metadata } =
        await splitRouteModuleIntoFiles({
          context,
          routeFileAbsPath: join(routesDir, basePath, entryPoint),
          interceptors: routeInterceptors,
        });

      filesToFormat.push(component, hydration);
      if (loader) {
        filesToFormat.push(loader);
      }

      filesToBundle.push(hydration);

      routes.push(
        createRouteHandlersFromRouteModule({
          context,
          importMap: {
            component,
            hash,
            hydration,
            interceptors: routeInterceptors,
            loader,
            metadata,
          },
          routeMatch,
        })
      );
    }
  }

  await formatFiles({
    target: "Route Files",
    entryFiles: filesToFormat,
  });

  return {
    routes,
    filesToBundle,
  };
}

function fsPathToRoutePattern(routePath: string): string {
  const parts = fileNameWithNoExt(routePath).split(SEPARATOR_PATTERN);

  for (let index = 0, L = parts.length; index < L; index++) {
    const part = parts[index];

    if (index === parts.length - 1) {
      if (part === "index") {
        parts.splice(index);
        break;
      }
    }

    if (part.includes("][")) {
      throw new Error(
        `Path must not contain multiple parameters without a separator. At: ${routePath}`
      );
    }

    if (part.startsWith("[...") && part.endsWith("]")) {
      const paramName = part.slice(4, -1);
      parts[index] = `:${paramName}*`;
      parts.splice(index + 1);
      break;
    }

    if (part.includes("[") && part.includes("]")) {
      let paramName = "";
      let partCopy = part;
      let currentChar = "";

      while (partCopy.length) {
        currentChar = partCopy[0];
        partCopy = partCopy.slice(1);

        if (currentChar === "[") {
          const closingBracketPosition = partCopy.indexOf("]");
          const nextOpeningBracketPosition = partCopy.indexOf("[");

          if (
            nextOpeningBracketPosition !== -1 &&
            nextOpeningBracketPosition < closingBracketPosition
          ) {
            throw new Error(
              `Opening bracket found before closing bracket at ${routePath}`
            );
          }

          if (closingBracketPosition === -1) {
            throw new Error(`No ending bracket found at ${routePath}`);
          }

          paramName += `:${partCopy.slice(0, closingBracketPosition)}`;
          partCopy = partCopy.slice(closingBracketPosition + 1);
        } else {
          paramName += currentChar;
        }
      }

      parts[index] = paramName;
      continue;
    }
  }

  return "/" + parts.join("/");
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
