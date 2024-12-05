import { isAbsolute, resolve, toFileUrl } from '@std/path';
import { walk } from '@std/fs/walk';

export class FsContext {
  private readonly absBaseUrl: string;
  constructor(private baseUrl: string) {
    if (baseUrl.startsWith('file://')) {
      this.absBaseUrl = new URL('.', baseUrl).pathname;
    } else if (isAbsolute(baseUrl)) {
      this.absBaseUrl = new URL('.', toFileUrl(baseUrl)).pathname;
    } else {
      throw TypeError(
        `manifest.baseUrl expected to be an absolute or file url. Received "${baseUrl}"`,
      );
    }
  }

  resolvePath(...segments: string[]): string {
    return resolve(this.absBaseUrl, ...segments);
  }

  getAppRoot(): string {
    return this.resolvePath('__root.tsx');
  }

  resolveFromOutDir(...segments: string[]): string {
    return this.resolvePath('.cooked', ...segments);
  }

  resolveRoute(...segments: string[]): string {
    return this.resolvePath('routes', ...segments);
  }

  walkRoutes(): ReturnType<typeof walk> {
    return walk(this.resolvePath('routes'), {
      includeDirs: false,
      includeSymlinks: false,
      match: [/\.(j|t)s(x?)$/],
    });
  }

  walkCollections(): ReturnType<typeof walk> {
    return walk(this.resolvePath('collections'), {
      includeDirs: false,
      includeSymlinks: false,
      match: [/\.md(x?)$/],
    });
  }
}
