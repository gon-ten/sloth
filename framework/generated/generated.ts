// THIS FILE IS AUTO GENERATED AND WILL BE OVERRIDEN FRECUENTLY. DO NOT MODIFY IT.
import type { ComponentType } from 'preact';
import { z } from 'zod';

import { config } from 'file:///Users/gdp/workspace/deno_blog/example/collections/config.ts';

type Config = typeof config;

type Content = ComponentType<unknown>;

type DefaultMetadata = Record<string, unknown>;

export type CollectionsMap = {
  'blogs': {
    entries: 'blog_01' | 'blog_02';
    metadata: z.infer<Config['blogs*']['schema']>;
    Content: Content;
  };
  'posts': {
    entries: 'hello-world' | 'test';
    metadata: DefaultMetadata;
    Content: Content;
  };
};
