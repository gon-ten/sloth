import { FsContext } from '../lib/fs_context.ts';
import { Interceptors, MetaFile, PageModule } from '../types.ts';
import { MIDDLEWARE_FILE_NAME } from '../shared/constants.ts';
import { LAYOUT_FILE_NAME } from '../shared/constants.ts';
import { relative } from '@std/path/relative';
import { Route } from '@std/http';
import { fsPathToRoutePattern } from '../utils/fs.ts';
import { withHeadSupport } from './index.ts';
import { renderRoute } from './render_route.ts';
import { loadModule } from '../utils/load_module.ts';

export const wellKnownFileNames = new Set([
  MIDDLEWARE_FILE_NAME,
  LAYOUT_FILE_NAME,
]);

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
  routeInterceptors: Interceptors[];
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
        params: params?.pathname.groups
          ? decodeRouteParams(params?.pathname.groups)
          : undefined,
      })
    ),
  };
}

function decodeRouteParams(
  params: Record<string, string | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map((
      [key, value],
    ) => [key, value && decodeURIComponent(value)]),
  );
}

export async function composeRoutes(
  fsContext: FsContext,
  metaFile: MetaFile,
): Promise<Route[]> {
  const routes: Array<{ route: Route }> = [];

  for (
    const [moduleSpecifier, { hash, interceptors }] of Object.entries(
      metaFile.routes,
    )
  ) {
    const pageModule = await loadModule<PageModule>(moduleSpecifier);

    const relativePath = relative(
      fsContext.resolvePath('routes'),
      moduleSpecifier,
    );

    const routeMatch = fsPathToRoutePattern(relativePath);

    routes.push(
      {
        route: createRouteHandlersFromRouteModule({
          hash,
          fsContext,
          routeMatch: routeMatch.pattern,
          pageModule: pageModule,
          routeInterceptors: interceptors,
        }),
      },
    );
  }

  return routes.map(({ route }) => route);
}
