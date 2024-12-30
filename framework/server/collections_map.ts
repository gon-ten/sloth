import { Fragment, h } from 'preact';
import { CollectionNotFoundError } from '../collections/errors.ts';
import { Script } from '../shared/scripts.ts';
import {
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from '../shared/constants.ts';
import type {
  Collection,
  CollectionMapEntry,
  CollectionName,
  CollectionsAllProvider,
  CollectionsMap,
  GetAllCollectionEntriesResult,
  GetCollectionEntryResult,
} from '../types.ts';
import { getCollection as getCollectionClient } from '../browser/collections_map.ts';

export const collectionsMap = new Map<
  string,
  Record<
    string,
    CollectionMapEntry
  >
>();

const cache = new Map<string, unknown>();

export class ServerCollection<C extends CollectionName>
  implements Collection<C> {
  readonly #collectionName: string;
  constructor(collectionName: C) {
    this.#collectionName = collectionName;
  }

  #getCollection() {
    const collection = collectionsMap.get(this.#collectionName) ?? {};
    if (!collection) {
      throw new CollectionNotFoundError();
    }
    return collection;
  }

  all(): GetAllCollectionEntriesResult<C> {
    const collection = this.#getCollection();

    const entries = Object.entries(collection).map(([name, { metadata }]) => ({
      name,
      metadata,
    }));

    const Provider: CollectionsAllProvider<CollectionsMap[C]['metadata']> = ({
      children,
    }) =>
      h(Fragment, {}, [
        ...entries.map(({ name, metadata }) =>
          children({
            name,
            metadata: metadata as CollectionsMap[C]['metadata'],
          })
        ),
        h(Script, {
          type: HYDRATION_SCRIPT_TYPE,
          dangerouslySetInnerHTML: {
            __html: JSON.stringify(entries),
          },
          [DATA_COLLECTION_NAME_ATTRIBUTE]: this.#collectionName,
        }),
      ]);

    return {
      Provider,
    };
  }
  // deno-lint-ignore ban-types
  get<T extends CollectionsMap[C]['entries'] | (string & {})>(
    entryName: T,
  ): GetCollectionEntryResult<C> {
    const collection = this.#getCollection();

    if (!Reflect.has(collection, entryName)) {
      throw new CollectionNotFoundError(this.#collectionName);
    }

    return collection[entryName] as GetCollectionEntryResult<C>;
  }

  // deno-lint-ignore ban-types
  has(entryName: keyof CollectionsMap[C] | (string & {})): boolean {
    return Reflect.has(this.#getCollection(), entryName);
  }

  keys(): string[] {
    return Object.keys(this.#getCollection());
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
