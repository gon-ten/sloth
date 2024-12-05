// THIS FILE IS AUTO GENERATED AND WILL BE OVERRIDEN FRECUENTLY. DO NOT MODIFY IT.
// deno-lint-ignore-file ban-types
import type { ComponentType } from 'preact';
import type * as v from '@valibot/valibot';
import type {
  CollectionsAllProvider,
  CollectionToc,
} from '@sloth/core/content';

import type { config } from './collections/config.ts';

type Config = typeof config;

type _CollectionsMap = {
  'blogs': {
    entries: 'blog-01';
    metadata: v.InferOutput<Config['blogs*']['schema']>;
    Content: ComponentType<unknown>;
    toc: CollectionToc;
  };
};

type CollectionName = keyof _CollectionsMap;

interface Collection<C extends CollectionName> {
  get(
    entryName: _CollectionsMap[C]['entries'] | (string & {}),
  ): Pick<_CollectionsMap[C], 'metadata' | 'Content' | 'toc'>;
  all(): {
    Provider: CollectionsAllProvider<_CollectionsMap[C]['metadata']>;
  };
  has(entryName: _CollectionsMap[C]['entries'] | (string & {})): boolean;
}

declare module '@sloth/core/content' {
  // @ts-ignore override
  export type CollectionsMap = _CollectionsMap;
  // @ts-ignore override
  export function getCollection<C extends CollectionName>(
    collectionName: C,
  ): Collection<C>;
}
