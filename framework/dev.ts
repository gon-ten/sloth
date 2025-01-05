import { SEPARATOR } from '@std/path/constants';
import { FsContext } from './lib/fs_context.ts';
import {
  AppConfigDev,
  CollectionsConfig,
  Interceptors,
  MetaFile,
  Mode,
} from './types.ts';
import { relative } from '@std/path/relative';
import { exists } from '@std/fs/exists';
import {
  compileCollections,
  readCollectionsConfig,
} from './collections/index.ts';
import { createDirectoryIfNotExists } from './utils/fs.ts';
import { wellKnownFileNames } from './server/routes.ts';
import { join } from '@std/path/join';
import { walk, WalkEntry } from '@std/fs/walk';
import { resolve } from '@std/path/resolve';
import * as esbuild from 'esbuild';
import { denoPlugins } from '@luca/esbuild-deno-loader';
import { md5 } from './utils/crypto.ts';
import {
  IndentationText,
  ModuleKind,
  ModuleResolutionKind,
  NewLineKind,
  Project,
  QuoteKind,
  ScriptTarget,
  SourceFile,
  SyntaxKind,
  ts,
  VariableDeclarationKind,
} from 'ts-morph';
import { basename } from '@std/path/basename';
import { extname } from '@std/path/extname';
import { LAYOUT_FILE_NAME, MIDDLEWARE_FILE_NAME } from './shared/constants.ts';
import { dirname } from '@std/path/dirname';
import { Builder } from './plugins/index.ts';
import { executionContext } from './server/index.ts';

export default async function (config: AppConfigDev) {
  const isBuild = Deno.args.includes('--build');
  const fsContext = new FsContext(config.baseUrl);

  executionContext.isDev = !isBuild;

  const outDir = fsContext.resolveFromOutDir('.');
  await Deno.remove(outDir, { recursive: true }).catch(() => null);
  await Deno.mkdir(outDir, { recursive: true }).catch(() => null);

  using buildCtx = new BuildContext({
    fsContext,
    config,
    mode: isBuild ? 'production' : 'development',
  });

  await buildCtx.initialize();

  if (!isBuild) {
    const mainModule = new URL(config.entryPoint, config.baseUrl).href;
    await import(mainModule);
  }
}

async function copyPublicFiles(context: FsContext): Promise<void> {
  const publicDir = context.resolvePath('public');
  const publicDirExits = await exists(publicDir);

  if (!publicDirExits) {
    return;
  }

  const outDir = context.resolveFromOutDir('static');

  for await (const file of walk(publicDir, { includeDirs: false })) {
    const relativePath = relative(publicDir, file.path);
    const outDirDir = join(outDir, relativePath.slice(0, -file.name.length));
    await Deno.mkdir(outDirDir, {
      recursive: true,
    });
    await Deno.copyFile(file.path, resolve(outDir, relativePath));
  }
}

class BuildContext implements Disposable {
  #project!: Project;

  #fsContext: FsContext;

  #projectOutputDir: string;

  #projectSrcDir = SEPARATOR + 'src' + SEPARATOR;

  #projectDistDir = SEPARATOR + 'dist' + SEPARATOR;

  #config: AppConfigDev;

  #bundleContext: esbuild.BuildContext | undefined;

  #mode: Mode;

  constructor({ fsContext, config, mode }: {
    fsContext: FsContext;
    config: AppConfigDev;
    mode: Mode;
  }) {
    this.#fsContext = fsContext;

    this.#config = config;

    this.#mode = mode;

    this.#projectOutputDir = this.#fsContext.resolveFromOutDir('project');
  }

  #assertProjectInitialized() {
    if (!this.#project) {
      throw new Error('Project not initialized');
    }
  }

  async #extractInterceptors(routesEntries: WalkEntry[]) {
    const layouts: Map<string, {
      moduleSpecifier: string;
      virtualPath: string;
      hash: string;
    }> = new Map();

    const middlewares: Map<string, {
      hash: string;
      moduleSpecifier: string;
    }> = new Map();

    for (const entry of routesEntries) {
      const hash = await md5(entry.path);

      const ext = extname(entry.path);
      const pathWithHash = entry.path.slice(0, -entry.name.length) + hash + ext;
      const absRouteFilePath = entry.path.slice(0, -entry.name.length);

      if (entry.name === MIDDLEWARE_FILE_NAME) {
        middlewares.set(absRouteFilePath, {
          hash,
          moduleSpecifier: entry.path,
        });
      }

      if (entry.name === LAYOUT_FILE_NAME) {
        const virtualPath = this.#getVirtualPath(pathWithHash);

        layouts.set(absRouteFilePath, {
          hash,
          moduleSpecifier: entry.path,
          virtualPath: virtualPath,
        });
      }
    }
    return { layouts, middlewares };
  }

  async #addRoutesToProject(): Promise<MetaFile['routes']> {
    this.#assertProjectInitialized();

    const filesInRoutes = await Array.fromAsync(
      this.#fsContext.walkRoutesDir(),
    );

    const meta: MetaFile['routes'] = {};

    const { layouts, middlewares } = await this.#extractInterceptors(
      filesInRoutes,
    );

    const layoutsPathRelation = new Map<string, string>();

    for (const [, { moduleSpecifier, virtualPath }] of layouts.entries()) {
      const sourceFile = this.#project.createSourceFile(
        virtualPath,
        await Deno.readTextFile(moduleSpecifier),
      );
      layoutsPathRelation.set(
        moduleSpecifier,
        virtualPath,
      );
      this.#sanitizeFile(sourceFile, moduleSpecifier);
    }

    const findRouteInterceptors = (routePath: string): Interceptors[] => {
      const entryName = basename(routePath);
      const parts = routePath.slice(0, -entryName.length).split(SEPARATOR);
      let acc = SEPARATOR;
      const interceptors: Interceptors[] = [];
      for (const part of parts.slice(1, -1)) {
        acc += part + SEPARATOR;
        if (layouts.has(acc) || middlewares.has(acc)) {
          interceptors.push({
            layout: layouts.get(acc),
            middleware: middlewares.get(acc),
          });
        }
      }
      return interceptors;
    };

    for (const entry of filesInRoutes) {
      if (wellKnownFileNames.has(basename(entry.path))) {
        continue;
      }
      const interceptors = findRouteInterceptors(
        entry.path,
      );

      const routeHash = await md5(entry.path);

      const ext = extname(entry.path);
      const pathWithHash = entry.path.slice(0, -entry.name.length) + routeHash +
        ext;

      const routeVirtualPath = this.#getVirtualPath(pathWithHash);

      const sourceFile = this.#project.createSourceFile(
        routeVirtualPath,
        await Deno.readTextFile(entry.path),
      );

      this.#sanitizeFile(sourceFile, entry.path);
      this.#addBootstrap(
        {
          hash: routeHash,
          sourceFile,
          layouts: interceptors.filter(({ layout }) => Boolean(layout)).map(
            ({ layout }) => {
              const layoutDistVirtualRelativePath = '.' + SEPARATOR + relative(
                dirname(routeVirtualPath),
                layoutsPathRelation.get(layout!.moduleSpecifier)!,
              );
              return {
                moduleRelativeSpecifier: layoutDistVirtualRelativePath,
                hash: layout!.hash,
              };
            },
          ),
        },
      );
      sourceFile.formatText();
      sourceFile.fixUnusedIdentifiers();

      meta[entry.path] = {
        hash: routeHash,
        interceptors,
      };
    }

    return meta;
  }

  #getVirtualPath(absPath: string) {
    return this.#projectSrcDir +
      relative(this.#fsContext.resolvePath('.'), absPath);
  }

  #resolveFileExtension(path: string) {
    if (path.endsWith('.mdx') || path.endsWith('.md')) {
      return path.slice(0, -4) + '.tsx';
    }
    if (path.endsWith('.tsx')) {
      return path.slice(0, -4) + '.jsx';
    }
    return path.slice(0, -3) + '.js';
  }

  #resolveOutFilePath(srcVirtualPath: string) {
    return this.#resolveFileExtension(
      srcVirtualPath.slice(this.#projectSrcDir.length),
    );
  }

  async #addCollectionsToProject(): Promise<
    MetaFile['collections']
  > {
    const collectionsIndexSourceFile = this.#project.createSourceFile(
      '/src/collections/collections.ts',
    );

    collectionsIndexSourceFile.addImportDeclaration({
      moduleSpecifier: '@sloth/core/content',
      isTypeOnly: true,
      namedImports: [
        'AnyString',
        'CollectionToc',
        'CollectionsAllProvider',
        'DefaultCollectionMetadata',
        'CollectionsMap as DefaultCollectionsMap',
        'UnknownCollection',
      ],
    });

    const modDeclaration = collectionsIndexSourceFile.addModule({
      name: JSON.stringify('@sloth/core/content'),
    });

    collectionsIndexSourceFile.addInterface({
      name: 'ICollection',
      typeParameters: ['C extends ICollectionName'],
      isExported: true,
      methods: [
        {
          name: 'get',
          typeParameters: [
            'E extends ICollectionsMap[C]["entries"] | AnyString',
          ],
          parameters: [
            { name: 'collectionEntryName', type: 'E' },
          ],
          returnType: "Omit<ICollectionsMap[C], 'entries'>",
        },
        {
          name: 'has',
          typeParameters: ['E extends keyof ICollectionsMap[C]'],
          parameters: [
            { name: 'collectionEntryName', type: 'E | AnyString' },
          ],
          returnType: 'boolean',
        },
        {
          name: 'all',
          returnType:
            '{ Provider: CollectionsAllProvider<ICollectionsMap[C]["metadata"]>; }',
        },
        {
          name: 'keys',
          returnType: 'ReadonlyArray<ICollectionsMap[C]["entries"]>',
        },
      ],
    });

    const meta: MetaFile['collections'] = {};

    const configPath = this.#fsContext.resolvePath(
      './collections/config.ts',
    );

    const config: CollectionsConfig = await readCollectionsConfig(
      configPath,
    );

    const compileResult = await compileCollections({
      fsContext: this.#fsContext,
      config,
    });

    for (
      const [collectionName, { entries, configPath }] of Object.entries(
        compileResult,
      )
    ) {
      for (
        const [collectionEntryName, { content, metadata, relativePath, toc }]
          of Object.entries(entries)
      ) {
        const hash = await md5(relativePath);

        const ext = extname(relativePath);
        const pathWithHash =
          relativePath.slice(0, -basename(relativePath).length) + hash + ext;

        const virtualPath = this.#resolveFileExtension(
          this.#getVirtualPath(pathWithHash),
        );

        const sourceFile = this.#project.createSourceFile(
          virtualPath,
          content,
        );

        sourceFile.addImportDeclaration({
          moduleSpecifier: '@sloth/core/content',
          namedImports: ['CollectionToc', 'DefaultCollectionMetadata'],
        });

        sourceFile.addImportDeclaration({
          moduleSpecifier: this.#fsContext.resolvePath(
            './collections/config.ts',
          ),
          isTypeOnly: true,
          namedImports: ['config'],
        });

        sourceFile.addImportDeclaration({
          moduleSpecifier: '@valibot/valibot',
          isTypeOnly: true,
          namespaceImport: 'v',
        });

        sourceFile.addTypeAlias({
          name: 'Metadata',
          type: configPath
            ? `v.InferOutput<typeof config["${configPath}"]["schema"]>`
            : 'DefaultCollectionMetadata',
        });

        sourceFile.addImportDeclaration({
          moduleSpecifier: 'preact',
          namedImports: ['VNode'],
          isTypeOnly: true,
        });

        sourceFile.getFunction('MDXContent')?.setReturnType('VNode<{}>');

        sourceFile.addVariableStatements(
          [
            {
              isExported: true,
              declarationKind: VariableDeclarationKind.Const,
              declarations: [
                {
                  name: 'toc',
                  type: 'CollectionToc',
                  initializer: JSON.stringify(toc),
                },
              ],
            },
            {
              isExported: true,
              declarationKind: VariableDeclarationKind.Const,
              declarations: [
                {
                  name: 'metadata',
                  initializer: JSON.stringify(metadata),
                  type: 'Metadata',
                },
              ],
            },
          ],
        );

        meta[collectionName] ??= {};
        meta[collectionName][collectionEntryName] = {
          hash,
          moduleSpecifier: this.#fsContext.resolveFromOutDir(
            'project',
            this.#resolveOutFilePath(virtualPath),
          ),
        };
      }
    }

    collectionsIndexSourceFile.addImportDeclarations([
      {
        moduleSpecifier: '@valibot/valibot',
        isTypeOnly: true,
        namespaceImport: 'v',
      },
      {
        moduleSpecifier: 'preact',
        namedImports: ['ComponentType'],
        isTypeOnly: true,
      },
      {
        moduleSpecifier: configPath,
        namedImports: ['config'],
        isTypeOnly: true,
      },
    ]);

    modDeclaration.addTypeAliases([
      {
        name: 'CollectionName',
        type: 'keyof ICollectionsMap',
        isExported: true,
      },
      {
        name: 'Collection',
        typeParameters: ['C extends ICollectionName'],
        type: 'ICollection<C>',
        isExported: true,
      },
    ]);
    modDeclaration.addFunction(
      {
        name: 'getCollection',
        isExported: true,
        typeParameters: ['C extends AnyString'],
        parameters: [
          { name: 'collectionName', type: 'C' },
        ],
        returnType: 'UnknownCollection',
        overloads: Object.keys(compileResult).map(
          (collectionName) => {
            return {
              parameters: [
                {
                  name: 'collectionName',
                  type: JSON.stringify(collectionName),
                },
              ],
              returnType: `ICollection<${JSON.stringify(collectionName)}>`,
            };
          },
        ),
      },
    );

    collectionsIndexSourceFile.addInterface({
      name: 'ICollectionsMap',
      properties: Object.entries(compileResult).map(
        ([collectionName, { entries, configPath }]) => {
          return {
            name: JSON.stringify(collectionName),
            type: (writer) => {
              writer.writeLine('{');
              writer.writeLine(
                `entries: '${Object.keys(entries).join("'|'")}';`,
              );
              writer.write('metadata: ');
              writer.write(
                configPath
                  ? `v.InferOutput<typeof config['${configPath}']['schema']>;`
                  : 'DefaultCollectionMetadata;',
              );
              writer.writeLine('Content: ComponentType<unknown>;');
              writer.writeLine('toc: CollectionToc;');
              writer.writeLine('}');
            },
          };
        },
      ),
    });

    collectionsIndexSourceFile.addTypeAlias({
      name: 'ICollectionName',
      type: 'keyof ICollectionsMap',
    });

    return meta;
  }

  async initialize(): Promise<void> {
    this.#project = new Project({
      compilerOptions: {
        target: ScriptTarget.ESNext,
        moduleResolution: ModuleResolutionKind.Node16,
        module: ModuleKind.ESNext,
        jsx: ts.JsxEmit.Preserve,
        jsxImportSource: 'preact',
        outDir: this.#projectDistDir,
        allowJs: true,
        declaration: true,
        declarationDir: this.#projectDistDir,
        baseUrl: '/',
        allowImportingTsExtensions: true,
      },
      manipulationSettings: {
        quoteKind: QuoteKind.Single,
        indentationText: IndentationText.TwoSpaces,
        newLineKind: NewLineKind.CarriageReturnLineFeed,
        useTrailingCommas: false,
        insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces: true,
      },
      useInMemoryFileSystem: true,
    });

    using builder = new Builder(this.#fsContext);

    this.#config.plugins?.forEach((plugin) => plugin.setup(builder));

    const routesMeta = await this.#addRoutesToProject();
    const collectionsMeta = await this.#addCollectionsToProject();

    const metaFile: MetaFile = {
      routes: routesMeta,
      collections: collectionsMeta,
    };

    await this.#project.save();
    await this.#emit();

    if (this.#config.debug) {
      this.#listProjectDir('/');
    }

    await this.#writeProjectToFileSystem(this.#projectDistDir);

    await this.#bundle();
    await this.#copyStaticAssets();

    await Deno.writeTextFile(
      this.#fsContext.resolveFromOutDir('project', 'meta.json'),
      JSON.stringify(metaFile, null, 2),
    );

    await builder.wg.wait();
  }

  #listProjectDir(path: string) {
    this.#assertProjectInitialized();
    const projectFileSystem = this.#project.getFileSystem();
    for (const entry of projectFileSystem.readDirSync(path)) {
      if (entry.isDirectory) {
        this.#listProjectDir(entry.name);
      } else {
        console.log(entry.name);
      }
    }
  }

  async #writeProjectToFileSystem(path: string) {
    const projectFileSystem = this.#project.getFileSystem();
    for (const entry of projectFileSystem.readDirSync(path)) {
      const path = join(
        this.#projectOutputDir,
        entry.name.slice(this.#projectDistDir.length),
      );
      if (entry.isDirectory) {
        await createDirectoryIfNotExists(path);
        await this.#writeProjectToFileSystem(entry.name);
      } else {
        await Deno.writeTextFile(
          path,
          await projectFileSystem.readFile(entry.name),
        );
      }
    }
  }

  async #emit() {
    this.#assertProjectInitialized();
    await this.#project.emit();
  }

  #addBootstrap(
    { hash: routeHash, sourceFile, layouts }: {
      hash: string;
      sourceFile: SourceFile;
      layouts: Array<{
        moduleRelativeSpecifier: string;
        hash: string;
      }>;
    },
  ) {
    const bootstrapMod = import.meta.resolve('./browser/bootstrap.ts');
    sourceFile.addImportDeclarations([
      {
        moduleSpecifier: bootstrapMod,
        namedImports: ['bootstrap'],
      },
      {
        moduleSpecifier: '@sloth/core',
        namedImports: ['HydrationData'],
      },
    ]);
    const layoutImports: string[] = [];
    for (
      const [index, { moduleRelativeSpecifier, hash: layoutHash }] of layouts
        .entries()
    ) {
      const importName = `L${index}`;
      sourceFile.addImportDeclaration({
        moduleSpecifier: this.#resolveFileExtension(moduleRelativeSpecifier),
        defaultImport: importName,
      });
      layoutImports.push(`{ Layout: ${importName}, hash: "${layoutHash}" }`);
    }
    const layoutsVarName = 'layouts';
    sourceFile.addVariableStatement({
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          name: layoutsVarName,
          initializer: `[${layoutImports.join(', ')}]`,
        },
      ],
    });
    const defaultExport = sourceFile.getDefaultExportSymbol();
    const declarations = defaultExport?.getDeclarations();
    if (!declarations) {
      return;
    }
    const [declaration] = declarations;
    if (declaration.getKind() !== SyntaxKind.FunctionDeclaration) {
      return;
    }
    const name = defaultExport?.getFullyQualifiedName();
    if (!name) {
      return;
    }
    const symbolName = name.split('".').at(-1);
    sourceFile.removeDefaultExport();
    sourceFile.addFunction({
      name: '',
      isDefaultExport: true,
      parameters: [
        {
          name: 'hydrationData',
          type: 'HydrationData',
        },
      ],
      statements: [
        `bootstrap({ Page: ${symbolName}, hash: "${routeHash}", layouts: ${layoutsVarName}, hydrationData });`,
      ],
    });
  }

  #sanitizeFile(sourceFile: SourceFile, fsPath: string) {
    const entryName = basename(fsPath);

    const absEntryPath = fsPath.slice(0, -entryName.length);

    sourceFile.getImportDeclarations().forEach((importDeclaration) => {
      const moduleSpecifier = importDeclaration.getModuleSpecifier();
      const moduleSpecifierText = moduleSpecifier.getText().slice(1, -1);
      if (moduleSpecifierText.startsWith('../')) {
        const modulePath = resolve(absEntryPath, moduleSpecifierText);
        importDeclaration.setModuleSpecifier(modulePath);
      }
    });

    sourceFile.getVariableDeclarations().forEach((v) => {
      if (v.isExported()) {
        v.remove();
      }
    });

    sourceFile.getFunctions().forEach((f) => {
      if (f.isExported() && !f.isDefaultExport()) {
        f.remove();
      }
    });

    sourceFile.getExportDeclarations().forEach((exportDeclaration) => {
      exportDeclaration.removeModuleSpecifier().remove();
    });
  }

  #copyStaticAssets() {
    return copyPublicFiles(this.#fsContext);
  }

  async #createBundleContext(cwd: string) {
    const entryPoints = await Array.fromAsync(
      walk(this.#projectOutputDir, { match: [/\.js(x?)$/] }),
    );

    if (!this.#bundleContext) {
      this.#bundleContext = await esbuild.context(
        {
          entryPoints: [
            ...entryPoints.map((entry) => entry.path),
            import.meta.resolve('./browser/hot_reload.ts'),
          ],

          plugins: [
            ...denoPlugins({
              configPath: this.#fsContext.resolvePath('deno.json'),
            }),
          ],

          absWorkingDir: cwd,

          platform: 'browser',

          format: 'esm',
          target: 'esnext',

          splitting: true,
          bundle: true,
          treeShaking: true,
          minify: this.#mode === 'production',

          sourcemap: this.#mode === 'development',
          metafile: true,

          outdir: '.',

          legalComments: 'none',

          jsx: 'automatic',
          jsxImportSource: 'preact',

          external: this.#config.esbuildConfig?.external,

          define: {
            ...this.#config.esbuildConfig?.define,
            'globalThis.BUILD_TIME': JSON.stringify(true),
          },

          entryNames: '[name]',
          write: false,
        },
      );
    }

    return this.#bundleContext;
  }

  async #bundle() {
    const absWorkingDir = this.#fsContext.resolvePath('.');

    const ctx = await this.#createBundleContext(absWorkingDir);

    await ctx.cancel();

    const { outputFiles = [], metafile } = await ctx.rebuild();

    const promises: Promise<void>[] = [];
    for (const file of outputFiles) {
      const filePath = this.#fsContext.resolveFromOutDir(
        'static',
        relative(absWorkingDir, file.path),
      );
      const basePath = dirname(filePath);
      await createDirectoryIfNotExists(basePath);
      const fileAlreadyExists = await exists(filePath);
      if (fileAlreadyExists) {
        await Deno.remove(filePath);
      }
      promises.push(
        Deno.writeFile(filePath, file.contents, {
          createNew: true,
        }),
      );
    }

    await Deno.writeFile(
      this.#fsContext.resolveFromOutDir('metafile.json'),
      new TextEncoder().encode(JSON.stringify(metafile, null, 2)),
    );

    await Promise.all(promises);
  }

  async [Symbol.dispose]() {
    if (this.#bundleContext) {
      await this.#bundleContext.cancel();
      await esbuild.stop();
    }
  }
}
