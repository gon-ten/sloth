import { h, Fragment, type ComponentType } from "preact";
import { CollectionNotFoundError } from "./errors.ts";
import type { CollectionsMap } from "./generated/generated.ts";
import {
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from "./shared/constants.ts";
import type {
  CollectionsAllProvider,
  DefaultCollectionMetadata,
  MDXComponentProps,
} from "./types.ts";

export const collectionsMap = new Map<
  string,
  Record<
    string,
    {
      metadata: DefaultCollectionMetadata;
      Content: ComponentType<MDXComponentProps>;
    }
  >
>();

type CollectionName = keyof CollectionsMap;

export const getCollection = <C extends CollectionName>(
  collectionName: C
): {
  all(): {
    Provider: CollectionsAllProvider<CollectionsMap[C]["metadata"]>;
  };
  // deno-lint-ignore ban-types
  get<T extends CollectionsMap[C]["entries"] | (string & {})>(
    entryName: T
  ): Pick<CollectionsMap[C], "metadata" | "Content">;
  has(entryName: keyof CollectionsMap[C]): boolean;
} => {
  const collection = collectionsMap.get(collectionName) ?? {};
  return {
    all() {
      const entries = Object.entries(collection).map(
        ([entryName, { metadata }]) => ({
          entryName,
          metadata,
        })
      );
      return {
        Provider: ({ children }) =>
          h(Fragment, {}, [
            ...entries.map(({ entryName, metadata }) =>
              children({ entryName, metadata })
            ),
            h("script", {
              type: HYDRATION_SCRIPT_TYPE,
              dangerouslySetInnerHTML: {
                __html: JSON.stringify(entries),
              },
              [DATA_COLLECTION_NAME_ATTRIBUTE]: collectionName,
            }),
          ]),
      };
    },
    // deno-lint-ignore ban-types
    get<T extends CollectionsMap[C]["entries"] | (string & {})>(entryName: T) {
      if (!Reflect.has(collection, entryName)) {
        throw new CollectionNotFoundError();
      }
      return collection[entryName] as Pick<
        CollectionsMap[C],
        "metadata" | "Content"
      >;
    },
    has(entryName) {
      return Reflect.has(collection, entryName);
    },
  };
};
