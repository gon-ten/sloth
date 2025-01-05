import { Fragment, h } from 'preact';
import {
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from '../shared/constants.ts';
import type {
  AnyString,
  Collection,
  CollectionModule,
  CollectionName,
  CollectionsAllProvider,
  CollectionsAllProviderChildrenProps,
  CollectionsMap,
  GetAllCollectionEntriesResult,
  GetCollectionEntryResult,
} from '../types.ts';
import { mdxComponents } from '../shared/collections/components/index.ts';

declare global {
  interface Window {
    __collections__: Record<string, {
      entries: Record<string, CollectionModule>;
    }>;
  }
}

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
  get<T extends CollectionsMap[C]['entries'] | AnyString>(
    entryName: T,
  ): GetCollectionEntryResult<C> {
    const { default: Content, metadata, toc } = self
      .__collections__[this.#collectionName]
      .entries[entryName];

    return {
      Content: () => h(Content, { metadata, components: mdxComponents }),
      metadata: metadata,
      toc,
    };
  }

  has(entryName: keyof CollectionsMap[C] | AnyString): boolean {
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

  keys(): string[] {
    const dataContainer = document.querySelector(
      `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_COLLECTION_NAME_ATTRIBUTE}="${this.#collectionName}"]`,
    );

    let collection: CollectionsAllProviderChildrenProps[] = [];

    if (dataContainer) {
      collection = dataContainer.textContent
        ? JSON.parse(dataContainer.textContent)
        : collection;
    }

    return collection.map(({ name }) => name);
  }
}

export function getCollection<C extends CollectionName>(collectionName: C) {
  return new BrowserCollection(collectionName);
}

export const collectionsMap = new Map();
