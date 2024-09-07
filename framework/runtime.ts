import type { CollectionsMap, CollectionEntry } from "./generated/generated.ts";
export type {
  RootProps,
  PageProps,
  InferLoaderReturnType,
  CollectionsMap,
  CollectionEntry,
  Loader,
  ComposeRouteTypes,
} from "./types.ts";
export { ErrorBoundary, lazy } from "preact-iso";
import { collectionsMap } from "./collections_map.ts";

export const getCollection = <C extends keyof CollectionsMap>(
  collectionName: C
): {
  all(): CollectionsMap[C];
  get(entryName: keyof CollectionsMap[C]): CollectionEntry;
} => {
  const collection = (collectionsMap.get(collectionName) ??
    {}) as unknown as CollectionsMap[C];
  return {
    all() {
      return collection;
    },
    get(entryName) {
      return collection[entryName] as CollectionEntry;
    },
  };
};
