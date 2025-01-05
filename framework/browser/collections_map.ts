import { Fragment, h } from 'preact';
import type {
  AnyString,
  Collection,
  CollectionIndexModule,
  CollectionModule,
  CollectionName,
  CollectionsAllProvider,
  CollectionsMap,
  GetAllCollectionEntriesResult,
  GetCollectionEntryResult,
} from '../types.ts';
import { mdxComponents } from '../shared/collections/components/index.ts';

declare global {
  interface Window {
    __collections__: Record<string, {
      index: CollectionIndexModule;
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

  #getCollection() {
    return self.__collections__[this.#collectionName] ?? {};
  }

  all(): GetAllCollectionEntriesResult<C> {
    const collection = this.#getCollection();
    const Provider: CollectionsAllProvider = ({ children }) =>
      h(
        Fragment,
        {},
        Object.entries(collection.index.entries).map(([slug, { metadata }]) =>
          children({ slug, metadata })
        ),
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
    const collection = this.#getCollection();
    return Reflect.has(collection.index.entries, entryName);
  }

  keys(): string[] {
    const collection = this.#getCollection();
    return Object.keys(collection.index.entries);
  }
}

export function getCollection<C extends CollectionName>(collectionName: C) {
  return new BrowserCollection(collectionName);
}

export const collectionsMap = new Map();
