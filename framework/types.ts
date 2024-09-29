import type { VNode, ComponentType } from "preact";
import type { JSX } from "preact";
import type { ZodSchema } from "zod";

export type Manifest = {
  baseUrl: string;
  ssrOnly?: boolean;
};

export type RootProps = {
  Metadata: ComponentType;
  links: JSX.Element | JSX.Element[];
  children: JSX.Element;
};

export type RootModule = {
  default: ComponentType<RootProps>;
};

export type PostsBarrelExport = {
  default: Record<string, () => Promise<{ default: () => VNode }>>;
};

export type HandlerContext<Data extends unknown = unknown> = {
  render(data: Data): Promise<Response> | Response;
  renderNotFound(): Promise<Response> | Response;
};

export type RouteHandler<Data extends unknown = unknown> = (
  req: Request,
  ctx: HandlerContext<Data>
) => Response | Promise<Response> | void | Promise<void>;

export const httpMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "PATCH",
] as const;

export type HttpMethod = (typeof httpMethods)[number];

export type RouteHandlers<Data extends unknown = unknown> = Partial<
  Record<HttpMethod, RouteHandler<Data>>
>;

export type RouteConfig = {
  skipInheritedLayouts?: boolean;
};

export type RouteModule = {
  config?: RouteConfig;
  metadata?: Metadata;
  loader?: () => Promise<unknown> | unknown;
  default: () => VNode;
};

export type PageModule = {
  config?: RouteConfig;
  default: (props: PageProps) => VNode;
};

export type LoaderFunction = (args: {
  request: Request;
  params: Record<string, string>;
}) => Promise<unknown>;

export type LoaderModule = {
  default: LoaderFunction;
};

export type InferLoaderReturnType<C extends () => Promise<unknown>> =
  C extends () => Promise<infer T> ? T : never;

type RouteInterceptors = {
  hash: string;
  middleware?: string;
  layout?: string;
};

export type RouteImportMapEntry = {
  hash: string;
  hydration: string;
  component: string;
  loader?: string;
  interceptors: RouteInterceptors[];
  metadata?: string;
};

export type ImportMap = Record<string, RouteImportMapEntry>;

export type PageProps<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>
> = {
  url: string;
  data: Data;
  params: Params;
};

export type Loader<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>
> = (params: { request: Request; params: Params }) => Promise<Data>;

export type CookedFiles = string[];

export type CollectionModule = {
  default: () => VNode;
  frontmatter: Record<string, string | string[]>;
};

export type InferArrayType<A extends Array<unknown>> = A extends Array<infer T>
  ? T
  : never;

export type ComposeRouteTypes<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>
> = {
  Loader: Loader<Data, Params>;
  PageProps: PageProps<Data, Params>;
};

export type CollectionsMap = import("./generated/generated.ts").CollectionsMap;

export type LayoutProps<
  Data = unknown,
  Params extends Record<string, string> = Record<string, string>
> = PageProps<Data, Params> & {
  children: JSX.Element;
};
export type Layout = (props: LayoutProps) => VNode;

export type LayoutModule = {
  loader?: Loader;
  default: Layout;
};

export type MiddlewareModule = {
  handler: (req: Request) => Promise<Response | void> | Response | void;
};

export type Metadata = {
  title?: string;
  description?: string;
};

export type MetadataModule = {
  default: Metadata;
};

export type CollectionsConfigEntry = {
  schema: ZodSchema;
};

export type CollectionsConfig = Record<string, CollectionsConfigEntry>;

export type CollectionsConfigMod = {
  config: CollectionsConfig;
};

export type MDXComponentProps = { metadata: DefaultCollectionMetadata };

export type DefaultCollectionMetadata = Record<string, unknown>;

export type CollectionsAllProviderChildrenProps<M = DefaultCollectionMetadata> =
  {
    entryName: string;
    metadata: M;
  };

export type CollectionsAllProvider<
  M extends DefaultCollectionMetadata = DefaultCollectionMetadata
> = ComponentType<{
  children: (props: CollectionsAllProviderChildrenProps<M>) => VNode;
}>;

export type RelativePath = string;
export type AbsolutePath = string;
export type FileName = string;

export type Interceptors = {
  hash: string;
  middleware?: string;
  layout?: string;
};
