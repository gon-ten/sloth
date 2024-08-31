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
