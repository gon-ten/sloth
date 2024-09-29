import { type ComponentType, h, Fragment } from "preact";
import {
  DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE,
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from "../shared/constants.ts";
import type {
  CollectionsAllProvider,
  CollectionsAllProviderChildrenProps,
  DefaultCollectionMetadata,
  MDXComponentProps,
} from "../types.ts";

export const getCollection = (collectionName: string) => {
  return {
    get(collectionEntryName: string) {
      const metadataContainer = document.querySelector(
        `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${collectionName}"][${DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE}="${collectionEntryName}"]`
      );

      let metadata: DefaultCollectionMetadata = {};

      if (metadataContainer) {
        metadata = metadataContainer.textContent
          ? JSON.parse(metadataContainer.textContent)
          : metadata;
      }

      const Content: ComponentType<MDXComponentProps> =
        // deno-lint-ignore no-explicit-any
        (globalThis as unknown as any).__collections__[collectionEntryName];

      return {
        Content: () => h(Content, { metadata }),
        metadata: metadata,
      };
    },
    all() {
      const dataContainer = document.querySelector(
        `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${collectionName}"]`
      );

      let collection: CollectionsAllProviderChildrenProps[] = [];

      if (dataContainer) {
        collection = dataContainer.textContent
          ? JSON.parse(dataContainer.textContent)
          : collection;
      }

      const Provider: CollectionsAllProvider = ({ children }) =>
        h(
          Fragment,
          {},
          collection.map(({ entryName, metadata }) =>
            children({ entryName, metadata })
          )
        );

      return {
        Provider,
      };
    },
  };
};

export const collectionsMap = new Map();
