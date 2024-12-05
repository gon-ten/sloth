import { type ComponentType, Fragment, h } from 'preact';
import {
  DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE,
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from '../shared/constants.ts';
import type {
  Collection,
  CollectionName,
  CollectionsAllProvider,
  CollectionsAllProviderChildrenProps,
  CollectionsMap,
  GetAllCollectionEntriesResult,
  GetCollectionEntryResult,
  MDXComponentProps,
} from '../types.ts';
import { mdxComponents } from '../shared/collections/components/index.ts';
import type { CollectionMapEntry } from '../types.ts';

export class BrowserCollection<C extends CollectionName>
  implements Collection<C> {
  readonly #collectionName: string;

  constructor(collectionName: C) {
    this.#collectionName = collectionName;
  }

  all(): GetAllCollectionEntriesResult<C> {
    const dataContainer = document.querySelector(
      `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${this.#collectionName}"]`,
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
        collection.map(({ name, metadata }) => children({ name, metadata })),
      );

    return {
      Provider,
    };
  }
  // deno-lint-ignore ban-types
  get<T extends CollectionsMap[C]['entries'] | (string & {})>(
    entryName: T,
  ): GetCollectionEntryResult<C> {
    const metadataContainer = document.querySelector(
      `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${this.#collectionName}"][${DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE}="${entryName}"]`,
    );

    let metadata: CollectionMapEntry['metadata'] = {};
    let toc: CollectionMapEntry['toc'] = [];

    if (metadataContainer && metadataContainer.textContent) {
      const parsedData = JSON.parse(metadataContainer.textContent);
      metadata = parsedData.metadata;
      toc = parsedData.toc;
    }

    const Content: ComponentType<MDXComponentProps> =
      // deno-lint-ignore no-explicit-any
      (globalThis as unknown as any).__collections__[entryName];

    return {
      Content: () => h(Content, { metadata, components: mdxComponents }),
      metadata: metadata,
      toc,
    };
  }

  // deno-lint-ignore ban-types
  has(entryName: keyof CollectionsMap[C] | (string & {})): boolean {
    const dataContainer = document.querySelector(
      `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${entryName}"]`,
    );

    let collection: CollectionsAllProviderChildrenProps[] = [];

    if (dataContainer) {
      collection = dataContainer.textContent
        ? JSON.parse(dataContainer.textContent)
        : collection;
    }

    return collection.some(({ name }) => name === entryName);
  }
}

export function getCollection<C extends CollectionName>(collectionName: C) {
  return new BrowserCollection(collectionName);
}

export const collectionsMap = new Map();
