import { CollectionIndexModule, CollectionModule } from './types.ts';

export {};

declare global {
  // deno-lint-ignore no-var
  var BUILD_TIME: boolean;
  // deno-lint-ignore no-var
  var __collections__: Record<string, {
    index: CollectionIndexModule;
    entries: Record<string, CollectionModule>;
  }>;
}
