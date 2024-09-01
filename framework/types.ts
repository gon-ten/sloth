import type { VNode } from "preact";

export type Manifest = {
  baseUrl: string;
};

export type RootModule = {
  default: () => VNode;
};

export type PostModule = {
  default: () => VNode;
};

export type PostsBarrelExport = {
  default: Record<string, () => Promise<{ default: () => VNode }>>;
};

export type RouteHandler = (
  req: Request
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

export type RouteHandlers = Partial<Record<HttpMethod, RouteHandler>>;

export type RouteModule = {
  handlers?: RouteHandlers;
  default: () => VNode;
};
