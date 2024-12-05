import { dirname, join, normalize, relative, SEPARATOR } from '@std/path';
import { FsContext } from '../../lib/fs_context.ts';
import { exists } from '@std/fs/exists';
import { TypedEvents } from '../../lib/typed_events.ts';
import { CollectionsEventMap, Lambda } from './types.ts';

export const collectionsEvents = new TypedEvents<CollectionsEventMap>();

class WaitGroup {
  #pending: number = 0;

  #signal: PromiseWithResolvers<void> = Promise.withResolvers();

  #done: boolean = false;

  constructor() {
    this.#signal.promise.finally(() => {
      this.#done = true;
    });
  }

  add(amount: number): void {
    if (this.#done) {
      throw Error(`Wg is already done`);
    }
    this.#pending += amount;
  }

  done(): void {
    this.#pending--;
    if (this.#pending === 0) {
      this.#signal.resolve();
    }
  }

  wait(): Promise<void> {
    if (this.#pending === 0) {
      this.#signal.resolve();
    }
    return this.#signal.promise;
  }
}

export class Builder {
  private fsContext: FsContext;

  private cleanups: Lambda[] = [];

  public readonly wg: WaitGroup = new WaitGroup();

  constructor(fsContext: FsContext) {
    this.fsContext = fsContext;
  }

  private fileExists(path: string): Promise<boolean> {
    return exists(path);
  }

  onCompileCollectionEnd(callback: CollectionsEventMap['end']): void {
    const dispose = collectionsEvents.on('end', callback);
    this.cleanups.push(dispose);
  }

  async copyStaticAsset(fromPath: string, toPath: string): Promise<void> {
    if (fromPath.length === 0) {
      throw new TypeError(`fromPath can not be an empty string`);
    }
    if (toPath.length === 0) {
      throw new TypeError(`toPath can not be an empty string`);
    }
    const safePath = join(SEPARATOR, normalize(toPath));
    const destinationPath = this.fsContext.resolveFromOutDir(
      'static',
      relative(SEPARATOR, safePath),
    );
    const fileAlreadyExists = await this.fileExists(destinationPath);
    if (fileAlreadyExists) {
      throw Error(
        `${toPath} already exists, please use another path or filename`,
      );
    }
    const contentDir = dirname(destinationPath);
    if (!(await exists(contentDir, { isDirectory: true }))) {
      await Deno.mkdir(
        contentDir,
        { recursive: true },
      );
    }
    await Deno.copyFile(fromPath, destinationPath);
  }

  #cleanup(): void {
    this.cleanups.forEach((cb) => cb());
  }

  [Symbol.dispose]() {
    this.#cleanup();
  }
}
