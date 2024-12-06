// deno-lint-ignore-file no-explicit-any
import { compile } from '@mdx-js/mdx';
import * as colors from '@std/fmt/colors';
import { extractYaml } from '@std/front-matter';
import { EOL } from '@std/fs/eol';
import { exists } from '@std/fs/exists';
import { SEPARATOR } from '@std/path/constants';
import { join } from '@std/path/join';
import { relative } from '@std/path/relative';
import { toFileUrl } from '@std/path/to-file-url';
import * as v from '@valibot/valibot';
import { all } from 'lowlight';
import { type ComponentType } from 'preact';
import rehypeHighlight from 'rehype-highlight';
import rehypeHighlightCodeLines from 'rehype-highlight-code-lines';
import { type CollectionMapEntry } from '../types.ts';
import { collectionsMap } from '../server/collections_map.ts';
import { withMetadata } from '../shared/collections/components/hoc/with_metadata.ts';
import {
  type CollectionsEventMap,
  collectionsEvents,
} from '../plugins/index.ts';
import type { FsContext } from '../lib/fs_context.ts';
import type {
  CollectionsConfig,
  CollectionsConfigMod,
  DefaultCollectionMetadata,
  MDXComponentProps,
} from '../types.ts';
import {
  checksum,
  createDirectoryIfNotExists,
  fileNameWithNoExt,
} from '../utils/fs.ts';
import { loadModule } from '../utils/load_module.ts';
import CodeBlockMetadataRehypePlugin from './rehype-plugins/code-block-metadata.ts';
import ImageSizeRehypePlugin from './rehype-plugins/image-size.ts';
import ListPrefixerRehypePlugin from './rehype-plugins/list-prefixer.ts';
import TocRehypePlugin, { Toc } from './rehype-plugins/toc.ts';

const textDecoder = new TextDecoder();

export async function readCollectionsConfig(
  fsContext: FsContext,
): Promise<CollectionsConfig> {
  const collectionsFile = fsContext.resolvePath('collections', 'config.ts');
  if (!(await exists(collectionsFile))) {
    return {};
  }
  const mod = await loadModule<CollectionsConfigMod>(
    fsContext.resolvePath('collections', 'config.ts'),
  );
  return mod.config;
}

export async function buildCollections(
  { fsContext }: {
    fsContext: FsContext;
  },
): Promise<{ filesToBundle: string[]; filesToFormat: string[] }> {
  const collectionsDir = fsContext.resolvePath('collections');

  const postsDirExists = await exists(collectionsDir);

  if (!postsDirExists) {
    console.warn(
      colors.yellow(
        `📜 Posts directory not found. Expected to be located at ${collectionsDir}`,
      ),
    );
    return {
      filesToBundle: [],
      filesToFormat: [],
    };
  }

  const collectionsConfig: CollectionsConfig = await readCollectionsConfig(
    fsContext,
  );

  const outCollectionsDir = fsContext.resolveFromOutDir('collections');
  await createDirectoryIfNotExists(outCollectionsDir);
  const postsToBundle: string[] = [];
  const collections: Record<
    string,
    {
      entries: Array<{
        srcFile: string;
        metadata: DefaultCollectionMetadata;
        mod: string;
        name: string;
        hash: string;
        toc: Toc;
      }>;
      schemaPath: string;
    }
  > = {};
  for await (const file of fsContext.walkCollections()) {
    const hash = await checksum(file.path);
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
          `Metadata could not be extracted in ${file.path}. Empty object will be used instead`,
        ),
      );
    }

    const baseUrl = file.path.slice(0, -file.name.length);

    let collectionToc: CollectionMapEntry['toc'] = [];

    const result = await compile(bodyToCompile, {
      outputFormat: 'program',
      jsxImportSource: 'preact',
      baseUrl: toFileUrl(baseUrl),
      rehypePlugins: [
        ImageSizeRehypePlugin({
          pathResolver: (imageSrc) =>
            join(fsContext.resolvePath('public'), imageSrc),
        }),
        CodeBlockMetadataRehypePlugin,
        [
          rehypeHighlight,
          {
            languages: all,
          },
        ],
        [rehypeHighlightCodeLines as any],
        ListPrefixerRehypePlugin,
        TocRehypePlugin({
          onDone(toc) {
            collectionToc = toc;
          },
        }),
      ],
    });

    const collectionEntryName = fileNameWithNoExt(file.name);
    const collectionPathPrefix = relative(collectionsDir, file.path).slice(
      0,
      -file.name.length,
    );

    const collectionDstDir = join(outCollectionsDir, collectionPathPrefix);
    const collectionDstPath = join(collectionDstDir, hash + '.jsx');

    await createDirectoryIfNotExists(collectionDstDir);

    const fileContent = typeof result.value === 'string'
      ? result.value
      : textDecoder.decode(result.value);

    await Deno.writeTextFile(collectionDstPath, fileContent, {
      createNew: true,
    });

    const collectionName = collectionPathPrefix
      .split(SEPARATOR)
      .filter(Boolean)
      .join(SEPARATOR);

    let schemaPath: string = '';
    for (const [pathMatch, config] of Object.entries(collectionsConfig)) {
      if (collectionName.match(pathMatch)) {
        schemaPath = pathMatch;
        try {
          metadata = (await v.parseAsync(
            config.schema,
            metadata,
          )) as DefaultCollectionMetadata;
        } catch (error) {
          console.error(
            colors.red(
              `${file.path} metadata does not match with the schema\n`,
            ),
            error,
          );
        }
        break;
      }
    }

    collections[collectionName] ??= {
      entries: [],
      schemaPath,
    };

    collections[collectionName].entries.push({
      metadata,
      name: collectionEntryName,
      mod: collectionDstPath,
      hash,
      srcFile: relative(collectionsDir, file.path),
      toc: collectionToc,
    });

    postsToBundle.push(collectionDstPath);
  }

  const collectionsEntries = Object.entries(collections);

  const generatedFilePath = fsContext.resolvePath('generated.d.ts');

  await Deno.writeTextFile(
    generatedFilePath,
    `// THIS FILE IS AUTO GENERATED AND WILL BE OVERRIDEN FRECUENTLY. DO NOT MODIFY IT.
    // deno-lint-ignore-file ban-types
    import type { ComponentType } from "preact";
    import type * as v from "@valibot/valibot";
    import type { CollectionsAllProvider, CollectionToc } from "@sloth/core/content";

    import type { config } from "./collections/config.ts";

    type Config = typeof config;

    type _CollectionsMap = { ${
      collectionsEntries
        .map(
          ([collectionName, collection]) =>
            `"${collectionName}": {
            entries: ${
              collection.entries
                .map(({ name }) => `"${name}"`)
                .join(' | ')
            },
            metadata: ${
              collection.schemaPath
                ? `v.InferOutput<Config["${collection.schemaPath}"]["schema"]>`
                : `import("@sloth/core").DefaultCollectionMetadata`
            },
            Content: ComponentType<unknown>,
            toc: CollectionToc
        },`,
        )
        .join(EOL)
    } }
    
    type CollectionName = keyof _CollectionsMap;
    
    interface Collection<C extends CollectionName> {
      get(entryName: _CollectionsMap[C]['entries'] | (string & {})): Pick<_CollectionsMap[C], 'metadata' | 'Content' | 'toc'>;
      all(): {
        Provider: CollectionsAllProvider<_CollectionsMap[C]['metadata']>
      };
      has(entryName: _CollectionsMap[C]['entries'] | (string & {})): boolean;
    }
    
    declare module "@sloth/core/content" {
      // @ts-ignore override
      export type CollectionsMap = _CollectionsMap;
      // @ts-ignore override
      export function getCollection<C extends CollectionName>(collectionName: C): Collection<C>;
    }
    `,
  );

  const collectionsEventsEndData: Parameters<CollectionsEventMap['end']>[0] =
    [];

  for (const [collectionName, { entries }] of collectionsEntries) {
    if (!collectionsMap.has(collectionName)) {
      collectionsMap.set(collectionName, {});
    }

    for (const entry of entries) {
      const module = await loadModule<{
        default: ComponentType<MDXComponentProps>;
      }>(entry.mod);

      collectionsEventsEndData.push(
        {
          MDXComponent: module.default,
          metadata: entry.metadata,
          path: entry.srcFile,
        },
      );

      collectionsMap.get(collectionName)![entry.name] = {
        Content: withMetadata({
          hash: entry.hash,
          Content: module.default,
          metadata: entry.metadata,
          collectionName,
          collectionEntryName: entry.name,
          toc: entry.toc,
        }),
        metadata: entry.metadata,
        toc: entry.toc,
      };
    }
  }

  collectionsEvents.emit('end', collectionsEventsEndData);

  const filesToFormat = [...postsToBundle];

  if (generatedFilePath) {
    filesToFormat.push(generatedFilePath);
  }

  return {
    filesToBundle: postsToBundle,
    filesToFormat,
  };
}
