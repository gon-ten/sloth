import { compile as mdxCompile } from "@mdx-js/mdx";
import type { ComponentType } from "preact";
import { all } from "lowlight";
import rehypeHighlight from "rehype-highlight";
import rehypeHighlightCodeLines from "rehype-highlight-code-lines";
import { lazy } from "preact-iso";
import { extractYaml } from "@std/front-matter";
import { exists } from "@std/fs/exists";
import { walk } from "@std/fs/walk";
import { basename } from "@std/path/basename";
import { SEPARATOR } from "@std/path/constants";
import { join } from "@std/path/join";
import { relative } from "@std/path/relative";
import { toFileUrl } from "@std/path/to-file-url";
import { collectionsMap } from "../collections_map.ts";
import { withMetadata } from "../components/hoc/with_metadata.ts";
import type { FsContext } from "../server/fs_context.ts";
import { loadModule } from "../utils/mod_cache.ts";
import type {
  CollectionsConfig,
  CollectionsConfigMod,
  DefaultCollectionMetadata,
} from "../types.ts";
import * as colors from "@std/fmt/colors";
import { createDirectoryIfNotExists, fileNameWithNoExt } from "../utils/fs.ts";
import { fromFileUrl } from "@std/path/from-file-url";
import { formatFiles } from "../utils/fmt.ts";

const textEncoder = new TextEncoder();

export async function compile(
  fsContext: FsContext
): Promise<{ filesToBundle: string[] }> {
  const collectionsDir = fsContext.resolvePath("collections");

  let collectionsConfig: CollectionsConfig = {};
  const collectionsConfigFile = join(collectionsDir, "config.ts");

  if (await exists(collectionsConfigFile)) {
    const { config } = await loadModule<CollectionsConfigMod>(
      collectionsConfigFile
    );
    collectionsConfig = config;
  }

  const postsDirExists = await exists(collectionsDir);

  if (!postsDirExists) {
    throw Error(
      `📜 Posts directory not found. Expected to be located at ${collectionsDir}`
    );
  }

  const rawCollectionsDir = fsContext.resolveFromOutDir("raw", "collections");
  await createDirectoryIfNotExists(rawCollectionsDir);
  const postsToBundle: string[] = [];
  const collections: Record<
    string,
    {
      collectionEntryNames: string[];
      schemaPath: string;
    }
  > = {};
  for await (const file of walk(collectionsDir, {
    includeDirs: false,
    match: [/.mdx$/],
  })) {
    const content = await Deno.readTextFile(file.path);

    let bodyToCompile = content;
    let metadata: DefaultCollectionMetadata = {};

    try {
      const { attrs, body } = extractYaml(content);
      bodyToCompile = body;
      metadata = attrs as DefaultCollectionMetadata;
    } catch {
      console.warn(
        colors.yellow(
          `Metadata could not be extracted in ${file.path}. Empty object will be used instead`
        )
      );
    }

    const baseUrl = file.path.slice(0, -basename(file.path).length);

    const result = await mdxCompile(bodyToCompile, {
      outputFormat: "program",
      jsxImportSource: "preact",
      baseUrl: toFileUrl(baseUrl),
      rehypePlugins: [
        [
          rehypeHighlight,
          {
            languages: all,
          },
        ],
        // deno-lint-ignore no-explicit-any
        [rehypeHighlightCodeLines as any],
      ],
    });

    const collectionEntryName = fileNameWithNoExt(file.name);
    const collectionPathPrefix = relative(collectionsDir, file.path).slice(
      0,
      -file.name.length
    );

    const collectionDstDir = join(rawCollectionsDir, collectionPathPrefix);
    const collectionDstPath = join(
      collectionDstDir,
      collectionEntryName + ".jsx"
    );

    await createDirectoryIfNotExists(collectionDstDir);

    const fileContent =
      typeof result.value === "string"
        ? textEncoder.encode(result.value)
        : result.value;

    await Deno.writeFile(collectionDstPath, fileContent, { createNew: true });

    const collectionName = collectionPathPrefix
      .split(SEPARATOR)
      .filter(Boolean)
      .join(SEPARATOR);

    let schemaPath: string = "";
    for (const [pathMatch, config] of Object.entries(collectionsConfig)) {
      if (collectionName.match(pathMatch)) {
        schemaPath = pathMatch;
        try {
          metadata = await config.schema.parseAsync(metadata);
        } catch (error) {
          console.error(
            colors.red(
              `${file.path} metadata does not match with the schema\n`
            ),
            error
          );
        }
        break;
      }
    }

    collections[collectionName] ??= {
      collectionEntryNames: [],
      schemaPath,
    };

    collections[collectionName].collectionEntryNames.push(collectionEntryName);

    if (!collectionsMap.has(collectionName)) {
      collectionsMap.set(collectionName, {});
    }

    collectionsMap.get(collectionName)![collectionEntryName] = {
      Content: lazy(async () => {
        const module = await loadModule<{
          default: ComponentType<{ metadata: typeof metadata }>;
        }>(collectionDstPath);
        return withMetadata({
          Content: module.default,
          metadata,
          collectionName,
          collectionEntryName,
        });
      }),
      metadata,
    };

    postsToBundle.push(collectionDstPath);
  }

  const generatedTypesFilePath = fromFileUrl(
    new URL("../generated/generated.ts", import.meta.url).href
  );

  await Deno.writeTextFile(
    generatedTypesFilePath,
    `// THIS FILE IS AUTO GENERATED AND WILL BE OVERRIDEN FRECUENTLY. DO NOT MODIFY IT.
    import type { ComponentType } from "preact";
    import { z } from "zod";

    import { config } from "${toFileUrl(collectionsConfigFile)}";

    type Config = typeof config;
    
    type Content = ComponentType<unknown>;
    
    type DefaultMetadata = Record<string, unknown>;
    
    export type CollectionsMap = { ${Object.entries(collections)
      .map(
        ([key, collection]) =>
          `"${key}": {
            entries: ${collection.collectionEntryNames
              .map((collectionEntryName) => `"${collectionEntryName}"`)
              .join(" | ")},
            metadata: ${
              collection.schemaPath
                ? `z.infer<Config["${collection.schemaPath}"]["schema"]>`
                : `DefaultMetadata`
            },
            Content: Content
        }`
      )
      .join(",")} }
    `
  );

  await formatFiles({
    entryFiles: [...postsToBundle, generatedTypesFilePath],
    target: "Collections Files",
  });

  return {
    filesToBundle: postsToBundle,
  };
}
