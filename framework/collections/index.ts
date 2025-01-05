import { compile } from '@mdx-js/mdx';
import * as colors from '@std/fmt/colors';
import { extractYaml } from '@std/front-matter';
import { exists } from '@std/fs/exists';
import { SEPARATOR } from '@std/path/constants';
import { join } from '@std/path/join';
import { relative } from '@std/path/relative';
import { toFileUrl } from '@std/path/to-file-url';
import * as v from '@valibot/valibot';
import { all } from 'lowlight';
import rehypeHighlight from 'rehype-highlight';
import rehypeHighlightCodeLines from 'rehype-highlight-code-lines';
import { collectionsMap } from '../server/collections_map.ts';
import { withClientCode } from '../shared/collections/components/hoc/with_client_code.ts';
import type { FsContext } from '../lib/fs_context.ts';
import type {
  CollectionModule,
  CollectionsConfig,
  CollectionsConfigEntry,
  CollectionsConfigMod,
  CollectionToc,
  DefaultCollectionMetadata,
  MetaFile,
} from '../types.ts';
import { loadModule } from '../utils/load_module.ts';
import CodeBlockMetadataRehypePlugin from './rehype-plugins/code-block-metadata.ts';
import ImageSizeRehypePlugin from './rehype-plugins/image-size.ts';
import ListPrefixerRehypePlugin from './rehype-plugins/list-prefixer.ts';
import TocRehypePlugin from './rehype-plugins/toc.ts';
import { basename } from '@std/path/basename';
import { extname } from '@std/path/extname';

type CollectionManifest = {
  [mdxFileRelativePath: string]: {
    collectionName: string;
    collectionEntryName: string;
    hash: string;
    module: CollectionModule;
    metadata: DefaultCollectionMetadata;
    toc: CollectionToc;
  };
};

type ManifestInitializer = {
  [mdxFileRelativePath: string]: {
    hash: string;
    collectionName: string;
    collectionEntryName: string;
    cookedPath: string;
    metadata: DefaultCollectionMetadata;
    toc: CollectionToc;
  };
};

const textDecoder = new TextDecoder();

export async function readCollectionsConfig(
  path: string,
): Promise<CollectionsConfig> {
  if (!(await exists(path))) {
    return {};
  }
  const mod = await loadModule<CollectionsConfigMod>(
    path,
  );
  return mod.config;
}

export async function loadCollections(
  { metaFile }: { metaFile: MetaFile },
) {
  for (
    const [collectionName, collectionEntries] of Object.entries(
      metaFile.collections,
    )
  ) {
    for (
      const [collectionEntryName, { hash, moduleSpecifier }] of Object.entries(
        collectionEntries,
      )
    ) {
      const { default: Content, toc, metadata } = await loadModule<
        CollectionModule
      >(moduleSpecifier);

      if (!collectionsMap.has(collectionName)) {
        collectionsMap.set(collectionName, {});
      }

      collectionsMap.get(collectionName)![collectionEntryName] = {
        Content: withClientCode({
          hash,
          Content,
          metadata,
          collectionName,
          collectionEntryName,
        }),
        metadata,
        toc,
      };
    }
  }
}

export async function compileCollection(
  { fsContext, filePath, schema }: {
    fsContext: FsContext;
    filePath: string;
    schema?: CollectionsConfigEntry['schema'];
  },
): Promise<{
  collectionName: string;
  collectionEntryName: string;
  content: string;
  toc: CollectionToc;
  metadata: DefaultCollectionMetadata;
}> {
  const content = await Deno.readTextFile(filePath);

  let bodyToCompile = content;
  let metadata: DefaultCollectionMetadata = {};

  try {
    const { attrs, body } = extractYaml(content);
    bodyToCompile = body;
    metadata = attrs as DefaultCollectionMetadata;
  } catch {
    console.warn(
      colors.yellow(
        `Metadata could not be extracted in ${filePath}. Empty object will be used instead`,
      ),
    );
  }

  const basePath = filePath.slice(0, -basename(filePath).length);

  let collectionToc: CollectionToc = [];

  const result = await compile(bodyToCompile, {
    outputFormat: 'program',
    jsxImportSource: 'preact',
    baseUrl: toFileUrl(basePath),
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
      // deno-lint-ignore no-explicit-any
      [rehypeHighlightCodeLines as any],
      ListPrefixerRehypePlugin,
      TocRehypePlugin({
        onDone(toc) {
          collectionToc = toc;
        },
      }),
    ],
  });

  const collectionsDir = fsContext.resolvePath('collections');
  const collectionRelativePath = relative(collectionsDir, filePath);

  const ext = extname(filePath);
  let collectionEntryName = basename(filePath);
  let collectionName = collectionRelativePath.slice(
    0,
    -collectionEntryName.length,
  );

  if (collectionName.endsWith(SEPARATOR)) {
    collectionName = collectionName.slice(0, -SEPARATOR.length);
  }

  collectionEntryName = collectionEntryName.slice(0, -ext.length);

  if (schema) {
    try {
      metadata = (await v.parseAsync(
        schema,
        metadata,
      )) as DefaultCollectionMetadata;
    } catch (error) {
      console.error(
        colors.red(
          `${filePath} metadata does not match with the schema\n`,
        ),
        error,
      );
    }
  }

  return {
    collectionName,
    collectionEntryName,
    content: typeof result.value === 'string'
      ? result.value
      : textDecoder.decode(result.value),
    toc: collectionToc,
    metadata,
  };
}

type CompileCollectonsResult = {
  [collectionName: string]: {
    configPath: string | undefined;
    entries: {
      [collectionEntryName: string]: {
        relativePath: string;
        content: string;
        metadata: DefaultCollectionMetadata;
        toc: CollectionToc;
      };
    };
  };
};

export async function compileCollections(
  { fsContext, config }: {
    fsContext: FsContext;
    config: CollectionsConfig;
  },
): Promise<CompileCollectonsResult> {
  const collectionsDir = fsContext.resolvePath('collections');
  const collectionsDirExists = await exists(collectionsDir);

  if (!collectionsDirExists) {
    return {};
  }

  const result: CompileCollectonsResult = {};

  for await (const entry of fsContext.walkCollectionsDir()) {
    const collectionRelativePath = relative(collectionsDir, entry.path);
    const { collectionEntryName, collectionName } = getCollectionPartsFromPath(
      collectionRelativePath,
    );

    const collectionConfigPath = findMatchingCollectionConfigPath(
      config,
      collectionName,
    );

    let schema: CollectionsConfigEntry['schema'] | undefined;
    if (collectionConfigPath) {
      schema = config[collectionConfigPath].schema;
    }

    result[collectionName] ??= {
      configPath: collectionConfigPath,
      entries: {},
    };

    const { content, metadata, toc } = await compileCollection({
      fsContext,
      filePath: entry.path,
      schema,
    });

    result[collectionName].entries[collectionEntryName] = {
      relativePath: join('collections', collectionRelativePath),
      content,
      metadata,
      toc,
    };
  }

  return result;
}

function findMatchingCollectionConfigPath(
  config: CollectionsConfig,
  collectionName: string,
): string | undefined {
  for (const pathMatch of Object.keys(config)) {
    if (collectionName.match(pathMatch)) {
      return pathMatch;
    }
  }
}

function getCollectionPartsFromPath(path: string) {
  const collectionEntryName = basename(path);
  let collectionName = path.slice(0, -collectionEntryName.length);
  while (collectionName.endsWith(SEPARATOR)) {
    collectionName = collectionName.slice(0, -SEPARATOR.length);
  }
  return {
    collectionName,
    collectionEntryName: collectionEntryName.slice(0, -extname(path).length),
  };
}
