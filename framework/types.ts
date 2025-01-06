import type { ComponentType, VNode } from 'preact';
import * as v from '@valibot/valibot';
import { metadataSchema } from './server/metadata.ts';
import { Plugin } from './plugins/core/types.ts';

const HTTP_METHOD = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

export type HttpMethod = typeof HTTP_METHOD[number];

export type RenderContext<D extends unknown, S extends unknown> = {
  state: S;
  renderNotFound(): Response;
  next: (error?: Error) => Promise<Response>;
  render: (data: D) => Promise<Response>;
  renderLayout: (data: D) => void;
};

export type Mode = 'development' | 'production';

export type BaseConfig = {
  plugins?: Plugin[];
};

export type AppConfigDev = {
  baseUrl: string;
  entryPoint: string;
  config: BaseConfig;
  plugins: Plugin[];
  debug?: boolean;
  esbuildConfig?: Pick<
    import('esbuild').BuildOptions,
    'define' | 'external'
  >;
};

export type AppConfig = {
  baseUrl: string;
};

export type RootProps<S extends unknown> = {
  Metadata: ComponentType;
  Links: ComponentType;
  Component: ComponentType;
  state: RenderContext<never, S>['state'];
};

export type RobotsModule = {
  default: (req: Request) => Response | Promise<Response>;
};

export type RootModule<S = unknown> = {
  default: ComponentType<RootProps<S>>;
};

export type PostsBarrelExport = {
  default: Record<string, () => Promise<{ default: () => VNode }>>;
};

export type HandlerContext<Data extends unknown = unknown> = {
  render(data: Data): Promise<Response> | Response;
  renderNotFound(): Promise<Response> | Response;
};

export type GenerateMetadataFunction<
  Params extends Record<string, string> = Record<string, string>,
  State extends JSONValue = JSONValue,
> = (
  args: { req: Request; params: Params; ctx: { state: Readonly<State> } },
) => Metadata | Promise<Metadata>;

export type ValidMetadata = Metadata | GenerateMetadataFunction;

export type PageModule = {
  metadata?: ValidMetadata;
  pageConfig?: PageConfig;
  loader?: Loader;
  default: (props: PageProps) => VNode;
};

export type InferLoaderReturnType<C extends () => Promise<unknown>> = C extends
  () => Promise<infer T> ? T : never;

export type RouteImportMapEntry = {
  path: string;
  hash: string;
  hydration?: string;
  interceptors: Interceptors[];
};

export type InterceptorsMap = Map<RelativePath, Interceptors>;

export type ImportMap = Record<string, RouteImportMapEntry>;

export type PageProps<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>,
> = {
  data: Data;
  params: Params;
  pageConfig: Pick<PageConfig, 'ssrOnly'>;
};

export type LayoutLoader<
  Data = JSONValue,
  Params extends UnknownParams = Record<string, string>,
  State = JSONValue,
> = (params: {
  req: Request;
  params: Params;
  ctx: Omit<RenderContext<Data, State>, 'render'>;
}) => Response | Promise<Response>;

export type Loader<
  Data = JSONValue,
  Params extends UnknownParams = Record<string, string>,
  State = JSONValue,
> = (params: {
  req: Request;
  params: Params;
  ctx: Omit<RenderContext<Data, State>, 'renderLayout'>;
}) => Response | Promise<Response>;

export type CookedFiles = string[];

export type CollectionModule = {
  default: () => VNode;
  toc: CollectionToc;
  metadata: DefaultCollectionMetadata;
};

export type InferArrayType<A extends Array<unknown>> = A extends Array<infer T>
  ? T
  : never;

export type ComposeRouteTypes<
  Data = unknown,
  Params extends UnknownParams = Record<string, string>,
> = {
  Loader: Loader<Data, Params>;
  PageProps: PageProps<Data, Params>;
};

export type UnknownParams = Record<string, string>;

export type LayoutProps<
  Data = unknown,
  Params extends UnknownParams = Record<string, string>,
> = PageProps<Data, Params> & {
  Component: ComponentType;
};
export type Layout = (props: LayoutProps) => VNode;

export type LayoutModule = {
  loader?: LayoutLoader;
  default: Layout;
};

export type Middleware<State = JSONValue> = (params: {
  req: Request;
  ctx: RenderContext<JSONValue, State>;
}) => Promise<Response> | Response;

export type MiddlewareModule = {
  handler: Middleware;
};

export type Metadata = v.InferOutput<typeof metadataSchema>;

export type CollectionsConfigEntry = {
  schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
};

export type CollectionsConfig = Record<string, CollectionsConfigEntry>;

export type CollectionsConfigMod = {
  config: CollectionsConfig;
};

export type MDXComponentProps = {
  metadata: DefaultCollectionMetadata;
  // deno-lint-ignore no-explicit-any
  components?: Record<string, ComponentType<any>>;
};

export type DefaultCollectionMetadata = JSONObject;

export type CollectionToc = Array<{
  content: string;
  deep: number;
  hash: string;
}>;

export type CollectionsAllProviderChildrenProps<M = DefaultCollectionMetadata> =
  {
    slug: string;
    metadata: M;
  };

export type CollectionsAllProvider<
  M extends DefaultCollectionMetadata = DefaultCollectionMetadata,
> = ComponentType<{
  children: (props: CollectionsAllProviderChildrenProps<M>) => VNode;
}>;

export type RelativePath = string;
export type AbsolutePath = string;
export type FileName = string;

export type Interceptors = {
  middleware?: MetaFileMiddleware;
  layout?: MetaFileLayout;
};

type ValidateShape = {
  params?: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>;
};

type ReadonlyNonEmptyArray<T> = readonly [T, ...T[]];

export type PageConfig = {
  allowedMethods?: ReadonlyNonEmptyArray<HttpMethod>;
  ssrOnly?: boolean;
  skipInheritedLayouts?: boolean;
  defineValidationSchemas?: () => ValidateShape;
};

type ValidationKeys = keyof NonNullable<ValidateShape>;

export type InferValidateOptions<
  C extends PageConfig,
  K extends ValidationKeys,
> = C extends never ? never
  : C['defineValidationSchemas'] extends () => ValidateShape
    ? ReturnType<C['defineValidationSchemas']>[K] extends v.BaseSchema<
      unknown,
      unknown,
      v.BaseIssue<unknown>
    > ? v.InferOutput<ReturnType<C['defineValidationSchemas']>[K]>
    : never
  : never;

export type CollectionName = string;

export type DefaultCollectionEntry = {
  entries: string;
  metadata: DefaultCollectionMetadata;
  Content: ComponentType<unknown>;
  toc: CollectionToc;
};

export type CollectionsMap = {
  [key: string]: DefaultCollectionEntry;
};

export type GetCollectionEntryResult<C extends CollectionName> = Pick<
  CollectionsMap[C],
  'metadata' | 'Content' | 'toc'
>;

export type GetAllCollectionEntriesResult<C extends CollectionName> = {
  Provider: CollectionsAllProvider<CollectionsMap[C]['metadata']>;
};

export interface Collection<C extends CollectionName> {
  get(
    entryName: string,
  ): GetCollectionEntryResult<C>;
  all(): GetAllCollectionEntriesResult<C>;
  has(entryName: string): boolean;
  keys(): string[];
}

export type GetCollectionFn = <C extends CollectionName>(
  collectionName: C,
) => Collection<C>;

export type CollectionMapEntry = {
  metadata: DefaultCollectionMetadata;
  Content: ComponentType<MDXComponentProps>;
  toc: CollectionToc;
};

export type MetaFileLayout = {
  hash: string;
  moduleSpecifier: string;
};

export type MetaFileMiddleware = {
  hash: string;
  moduleSpecifier: string;
};

export type MetaFile = {
  routes: {
    [path: string]: {
      hash: string;
      interceptors: Interceptors[];
    };
  };
  collections: {
    [collectionName: string]: {
      index: string;
      entries: {
        [collectionEntryName: string]: {
          hash: string;
          moduleSpecifier: string;
        };
      };
    };
  };
};

export type MetaFileModule = {
  default: MetaFile;
};

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONValue[];

export type JSONObject = {
  [key: string | number]: JSONValue;
};

// deno-lint-ignore ban-types
export type AnyString = string & {};

export interface UnknownCollection {
  get<E extends AnyString>(
    collectionEntryName: E,
  ): Omit<DefaultCollectionEntry, 'entries'>;
  has<E extends AnyString>(collectionEntryName: E): boolean;
  all(): {
    Provider: CollectionsAllProvider<JSONObject>;
  };
  keys(): ReadonlyArray<string>;
}

export type HydrationData = [
  sharedProps: JSONObject,
  dataMap: JSONObject,
];

export type CollectionIndexModule = {
  hash: string;
  entries: {
    [slug: string]: {
      metadata: DefaultCollectionMetadata;
    };
  };
};
