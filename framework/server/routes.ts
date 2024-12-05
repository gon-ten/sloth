import { basename } from '@std/path/basename';
import { FsContext } from '../lib/fs_context.ts';
import {
  Interceptors,
  InterceptorsMap,
  Manifest,
  PageModule,
  RouteInterceptors,
} from '../types.ts';
import { MIDDLEWARE_FILE_NAME } from '../shared/constants.ts';
import { LAYOUT_FILE_NAME } from '../shared/constants.ts';
import { relative } from '@std/path/relative';
import { SEPARATOR } from '@std/path/constants';
import { Route } from '@std/http';
import { fsPathToRoutePattern } from '../utils/fs.ts';
import { join } from '@std/path/join';
import { withHeadSupport } from './index.ts';
import { renderRoute } from './render_route.ts';

const wellKnownFileNames = new Set([MIDDLEWARE_FILE_NAME, LAYOUT_FILE_NAME]);

function isPageModule(obj: unknown): obj is PageModule {
  return typeof obj === 'object' && obj !== null && 'default' in obj &&
    typeof obj.default === 'function';
}

export function* iterateManifestRoutes(
  { fsContext, manifest, options }: {
    fsContext: FsContext;
    manifest: Manifest;
    options?: {
      omitWellKnownFiles?: boolean;
    };
  },
): Generator<{
  hash: string;
  absRouteFilePath: string;
  entryName: string;
  relativePath: string;
  module: unknown;
}> {
  const { omitWellKnownFiles = false } = options ?? {};
  const routesDir = fsContext.resolvePath('routes');
  for (
    const [routeFilePath, [hash, module]] of Object.entries(manifest.routes)
  ) {
    const entryName = basename(routeFilePath);
    const isWellKnownFile = wellKnownFileNames.has(entryName);
    if (!isWellKnownFile && !isPageModule(module)) {
      throw Error("Page module isn't a valid page module");
    }
    if (omitWellKnownFiles && isWellKnownFile) {
      continue;
    }
    const absRouteFilePath = fsContext.resolvePath(routeFilePath);
    let relativePath = relative(
      routesDir,
      routeFilePath.slice(0, -entryName.length),
    );
    if (relativePath.length === 0) {
      relativePath = '.';
    } else {
      relativePath = `.${SEPARATOR}${relativePath}`;
    }
    yield {
      hash,
      absRouteFilePath,
      entryName,
      relativePath,
      module,
    };
  }
}

export function extractInterceptors(
  { fsContext, manifest }: {
    fsContext: FsContext;
    manifest: Manifest;
  },
): InterceptorsMap {
  const interceptorsMap: InterceptorsMap = new Map();
  const routesIter = iterateManifestRoutes({
    fsContext,
    manifest,
  });
  for (
    const { absRouteFilePath, entryName, relativePath, hash } of routesIter
  ) {
    if (wellKnownFileNames.has(entryName)) {
      if (!interceptorsMap.has(relativePath)) {
        interceptorsMap.set(relativePath, { hash });
      }
      if (entryName === LAYOUT_FILE_NAME) {
        interceptorsMap.get(relativePath)!.layout = absRouteFilePath;
      } else if (entryName === MIDDLEWARE_FILE_NAME) {
        interceptorsMap.get(relativePath)!.middleware = absRouteFilePath;
      }
    }
  }
  return interceptorsMap;
}

export function findRouteInterceptors(
  relativePath: string,
  interceptorsMap: InterceptorsMap,
): Interceptors[] {
  const parts = relativePath.split(SEPARATOR);
  const routeInterceptors: Interceptors[] = [];
  let acc = '';
  for (const part of parts) {
    acc += part;
    if (interceptorsMap.has(acc)) {
      const { layout, middleware, hash } = interceptorsMap.get(acc)!;
      if (!middleware && !layout) {
        continue;
      }
      routeInterceptors.push({ middleware, layout, hash });
    }
    acc += SEPARATOR;
  }
  return routeInterceptors;
}

function createRouteHandlersFromRouteModule({
  hash,
  fsContext,
  routeMatch,
  pageModule,
  routeInterceptors,
}: {
  hash: string;
  fsContext: FsContext;
  routeMatch: string;
  pageModule: PageModule;
  routeInterceptors: RouteInterceptors[];
}): Route {
  const { pageConfig = {} } = pageModule;

  let methods: NonNullable<typeof pageConfig.allowedMethods> = ['GET', 'HEAD'];

  if (pageConfig.allowedMethods && pageConfig.allowedMethods.length > 0) {
    methods = pageConfig.allowedMethods;
  }

  return {
    method: methods as unknown as string[],
    pattern: new URLPattern({ pathname: routeMatch }),
    handler: withHeadSupport((req, _, params) =>
      renderRoute({
        routeHash: hash,
        fsContext,
        pageModule,
        routeInterceptors,
        req,
        params: params ?? undefined,
      })
    ),
  };
}

export function composeRoutes(
  fsContext: FsContext,
  manifest: Manifest,
): Route[] {
  const routes: Array<{ route: Route; deep: number }> = [];
  const interceptorsMap = extractInterceptors({
    fsContext,
    manifest,
  });

  for (
    const { relativePath, module, entryName, hash } of iterateManifestRoutes({
      fsContext,
      manifest,
      options: {
        omitWellKnownFiles: true,
      },
    })
  ) {
    const routeMatch = fsPathToRoutePattern(join(relativePath, entryName));

    const routeInterceptors = findRouteInterceptors(
      relativePath,
      interceptorsMap,
    );

    routes.push(
      {
        deep: routeMatch.deep,
        route: createRouteHandlersFromRouteModule({
          hash,
          fsContext,
          routeMatch: routeMatch.pattern,
          pageModule: module as PageModule,
          routeInterceptors,
        }),
      },
    );
  }

  return routes.toSorted((a, b) => a.deep - b.deep).map(({ route }) => route);
}
