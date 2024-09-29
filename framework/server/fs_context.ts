import { resolve, toFileUrl, isAbsolute } from "@std/path";
import type { Manifest } from "../types.ts";

export class FsContext {
  private readonly absBaseUrl: string;
  constructor(private manifest: Manifest) {
    if (manifest.baseUrl.startsWith("file://")) {
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

  resolveRoute(...segments: string[]): string {
    return this.resolvePath("routes", ...segments);
  }
}
