import { Image as ImageServer } from './shared/Images.ts';
import { Image as ImageClient } from './browser/Images.ts';

export let Image = ImageServer;
// This condition will be replaced when bundling (see define)
// deno-lint-ignore no-explicit-any
if ((globalThis as unknown as any).BUILD_TIME) {
  Image = ImageClient;
  // getCollection = getCollectionClient as unknown as typeof getCollectionServer;
}

export const IS_BROWSER = typeof document !== 'undefined';
