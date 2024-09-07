import type { VNode, FunctionComponent, ComponentType } from "preact";

export type Manifest = {
  baseUrl: string;
};

export type RootProps = {
  Component: ComponentType;
};

export type RootModule = {
  default: ComponentType<RootProps>;
};

export type AppModule = {
  ClientApp: FunctionComponent;
  ServerApp: FunctionComponent<{ url?: string; data: Record<string, unknown> }>;
};

export type PostModule = {
  default: () => VNode;
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

export type RouteModule = {
  loader: () => Promise<unknown> | unknown;
  default: () => VNode;
};

export type PageModule = {
  default: (props: PageProps) => VNode;
};

export type LoaderModule = {
  default: (args: {
    request: Request;
    params: Record<string, string>;
  }) => Promise<unknown>;
};

export type InferLoaderReturnType<C extends () => Promise<unknown>> =
  C extends () => Promise<infer T> ? T : never;

export type ImportMapEntry = {
  hash: string;
  hydration: string;
  component: string;
  loader: string;
};

export type ImportMap = Record<string, ImportMapEntry>;

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
  PagaProps: PageProps<Data, Params>;
};

export type CollectionsMap = import("./generated/generated.ts").CollectionsMap;
export type CollectionEntry =
  import("./generated/generated.ts").CollectionEntry;
