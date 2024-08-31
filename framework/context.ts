import { toFileUrl } from "@std/path";
import type { Manifest } from "./types.ts";
import { isAbsolute, resolve } from "@std/path";
import { isFileUrl } from "./utils.ts";

export class Context {
  private readonly absBaseUrl: string;
  constructor(private manifest: Manifest) {
    if (isFileUrl(manifest.baseUrl)) {
      this.absBaseUrl = new URL(".", manifest.baseUrl).pathname;
    } else if (isAbsolute(manifest.baseUrl)) {
      this.absBaseUrl = new URL(".", toFileUrl(manifest.baseUrl)).pathname;
    } else {
      throw TypeError(
        `manifest.baseUrl expected to be an absolute or file url. Received "${manifest.baseUrl}"`
      );
    }
  }

  resolvePath(...segments: string[]): string {
    return resolve(this.absBaseUrl, ...segments);
  }

  getAppRoot() {
    return this.resolvePath("__root.tsx");
  }

  resolveFromOutDir(...segments: string[]): string {
    return this.resolvePath(".cooked", ...segments);
  }
}
