import { Fragment, h } from 'preact';
import { CollectionNotFoundError } from '../collections/errors.ts';
import { Script } from '../shared/scripts.ts';
import type {
  AnyString,
  Collection,
  CollectionIndexModule,
  CollectionMapEntry,
  CollectionName,
  CollectionsAllProvider,
  CollectionsMap,
  GetAllCollectionEntriesResult,
  GetCollectionEntryResult,
} from '../types.ts';
import { getCollection as getCollectionClient } from '../browser/collections_map.ts';

type FlatCollection = {
  index: CollectionIndexModule;
  entries: Record<
    string,
    CollectionMapEntry
  >;
};

export const collectionsMap = new Map<
  string,
  FlatCollection
>();

const cache = new Map<string, unknown>();

export class ServerCollection<C extends CollectionName>
  implements Collection<C> {
  readonly #collectionName: string;
  constructor(collectionName: C) {
    this.#collectionName = collectionName;
  }

  #getCollection() {
    const collection = collectionsMap.get(this.#collectionName);
    if (!collection) {
      throw new CollectionNotFoundError(this.#collectionName);
    }
    return collection;
  }

  all(): GetAllCollectionEntriesResult<C> {
    const collection = this.#getCollection();

    const entries = Object.entries(collection.entries).map((
      [slug, { metadata }],
    ) => ({
      slug,
      metadata,
    }));

    const Provider: CollectionsAllProvider<CollectionsMap[C]['metadata']> = ({
      children,
    }) =>
      h(Fragment, {}, [
        ...entries.map(({ slug, metadata }) =>
          children({
            slug,
            metadata: metadata as CollectionsMap[C]['metadata'],
          })
        ),
        h(Script, {
          type: 'module',
          dangerouslySetInnerHTML: {
            __html: `
            import * as _ from "/static/${collection.index.hash}.js";
            window.__collections__ = window.__collections__ || {};
            window.__collections__["${this.#collectionName}"] = window.__collections__["${this.#collectionName}"] || { entries: {}, index: _ };
          `,
          },
        }),
      ]);

    return {
      Provider,
    };
  }

  get<T extends CollectionsMap[C]['entries'] | AnyString>(
    entryName: T,
  ): GetCollectionEntryResult<C> {
    const collection = this.#getCollection();

    if (!Reflect.has(collection.index.entries, entryName)) {
      throw new CollectionNotFoundError(this.#collectionName);
    }

    return collection.entries[entryName] as GetCollectionEntryResult<C>;
  }

  has(entryName: keyof CollectionsMap[C] | AnyString): boolean {
    return Reflect.has(this.#getCollection().index.entries, entryName);
  }

  keys(): string[] {
    return Object.keys(this.#getCollection().index.entries);
  }
}

type GetCollection = <C extends CollectionName>(
  collectionName: C,
) => ServerCollection<C>;

const getCollectionServer = <C extends CollectionName>(
  collectionName: C,
): ServerCollection<C> => {
  if (cache.has(collectionName)) {
    return cache.get(collectionName) as ServerCollection<C>;
  }
  const collection = new ServerCollection(collectionName);
  cache.set(collectionName, collection);
  return collection;
};

export const getCollection: GetCollection = globalThis.BUILD_TIME
  ? getCollectionClient as unknown as GetCollection
  : getCollectionServer;
