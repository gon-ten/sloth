import { deepMerge } from '@std/collections';
import * as v from '@valibot/valibot';
import * as colors from '@std/fmt/colors';
import { Fragment, h, type VNode } from 'preact';
import { renderToString } from 'preact-render-to-string';
import '../shared/option_hooks.ts';
import type {
  HydrationData,
  Interceptors,
  JSONObject,
  JSONValue,
  LayoutModule,
  MiddlewareModule,
  PageConfig,
  PageModule,
  PageProps,
  RenderContext,
  RootModule,
} from '../types.ts';
import { loadModule } from '../utils/load_module.ts';
import type { FsContext } from '../lib/fs_context.ts';
import {
  badRequest,
  internalServerError,
  notFound,
  ok,
} from './http_responses.ts';
import {
  type ScriptProps,
  Scripts,
  SCRIPTS_CONTEXT,
} from '../shared/scripts.ts';
import { createHash } from '../utils/crypto.ts';
import { Links, LINKS_CONTEXT, type LinksProps } from '../shared/links.ts';
import { metadataToVnode } from './metadata.ts';
import { executionContext } from './index.ts';
import { HEAD_CONTEXT } from '../shared/head.ts';
import { clientEnv } from '../env.ts';

const defaultConfig: Required<Omit<PageConfig, 'allowedMethods'>> = {
  ssrOnly: false,
  skipInheritedLayouts: false,
  defineValidationSchemas: () => ({}),
};

export type RenderRouteArgs = {
  routeHash: string;
  fsContext: FsContext;
  pageModule: PageModule;
  routeInterceptors: Interceptors[];
  req: Request;
  params?: Record<string, string | undefined>;
  csp?: boolean;
};

export async function renderRoute({
  routeHash,
  fsContext,
  pageModule,
  routeInterceptors,
  req,
  params: rawParams,
  csp = true,
}: RenderRouteArgs): Promise<Response> {
  const appRootPath = fsContext.getAppRoot();

  const [rootModule] = await Promise.all([
    loadModule<RootModule>(appRootPath),
  ]);

  const { default: Root } = rootModule;
  const { default: Page, pageConfig = {}, loader, metadata } = pageModule;
  // Merge given config with default config
  const fullPageConfig: PageConfig = deepMerge(defaultConfig, pageConfig);

  const ctx: RenderContext<JSONValue, JSONValue> = {
    state: null,
    renderNotFound: notFound,
    next() {
      return Promise.resolve(internalServerError());
    },
    render() {
      return Promise.resolve(internalServerError());
    },
    renderLayout() {
      return Promise.resolve(internalServerError());
    },
  };

  const validationSchemas = pageConfig.defineValidationSchemas?.();

  let params: Record<string, string> = {};

  if (rawParams) {
    // If schema exists then params will be validated
    if (validationSchemas?.params) {
      try {
        const result = await v.parseAsync(
          validationSchemas.params,
          rawParams,
        );
        params = result as Record<string, string>;
      } catch (error) {
        console.log('\n');
        console.error(error);
        return badRequest();
      }
    } else {
      params = Object.fromEntries(
        Object.entries(rawParams).filter(
          ([, value]) => typeof value !== 'undefined',
        ),
      ) as Record<string, string>;
    }
  }

  const sharedProps: Omit<PageProps, 'data'> = {
    pageConfig: { ssrOnly: pageConfig.ssrOnly },
    params,
  };

  // Data map to store layout and page data props. Used during ssr process and
  // it will be sent to the browser to be used during hydration process
  const dataMap: JSONObject = {};

  const composeInterceptors = async () => {
    const interceptors = routeInterceptors.concat();

    // Array of layouts wrapping page
    const layouts: Array<{
      hash: string;
      module: LayoutModule;
    }> = [];

    // Array of handlers to be consumed in order during the request lifecycle
    const handlers: Array<() => Promise<Response> | Response> = [];

    for (const { middleware, layout } of interceptors) {
      if (middleware) {
        const { moduleSpecifier } = middleware;
        const { handler } = await loadModule<MiddlewareModule>(moduleSpecifier);
        handlers.push(() => handler({ req, ctx, params }));
      }

      if (layout) {
        const { hash, moduleSpecifier } = layout;
        const layoutModule = await loadModule<LayoutModule>(moduleSpecifier);
        const { loader } = layoutModule;
        if (loader) {
          layouts.push({
            module: layoutModule,
            hash,
          });
          handlers.push(() => {
            let called = false;
            ctx.renderLayout = (data) => {
              dataMap[hash] = data;
              called = true;
            };
            const res = loader({ req, ctx, params });
            if (!called) {
              console.warn(
                colors.yellow(
                  'ctx.renderLayout has not been called. If layout expects some data, please provide it by calling ctx.renderLayout(data); undefined was passed instead.',
                ),
              );
            }
            return res;
          });
        }
      }
    }

    return { handlers, layouts };
  };

  const { handlers, layouts } = await composeInterceptors();

  // req -> next -> next -> next -> Response - Generated by route handler or early ending (middleware, loader, or layout loader...)
  //                                 |
  // res <- res  <- res  <- res  <- res
  ctx.next = async () => {
    const handler = handlers.shift()!;
    try {
      return await handler();
    } catch (err) {
      console.log(err);
      return internalServerError();
    }
  };

  const renderRoute: typeof ctx.render = async (data) => {
    // Add data to dataMap to be sent to the browser for hydration process
    dataMap[routeHash] = data;

    // deno-lint-ignore no-explicit-any
    let resultMetadata: VNode<any> | null = null;

    if (metadata) {
      const rawMetadata = typeof metadata === 'function'
        ? await metadata({ params, req, ctx: { state: ctx.state } })
        : metadata;

      resultMetadata = metadataToVnode(rawMetadata);
    }

    // Page component is wrapped within layouts
    let route = h(Page, { ...sharedProps, data });

    if (!fullPageConfig.skipInheritedLayouts) {
      // deno-lint-ignore no-explicit-any
      route = layouts.reduceRight<VNode<any>>(
        (acc, { module, hash }) => {
          const LayoutComponent = module.default;
          if (!LayoutComponent) {
            return acc;
          }
          return h(
            LayoutComponent,
            {
              ...sharedProps,
              data: dataMap[hash],
              Component: () => h(Fragment, {}, [acc]),
            },
          );
        },
        route,
      );
    }

    const hydrationData: HydrationData = [sharedProps, dataMap];

    const scriptsContextValue: ScriptProps[] = !pageConfig.ssrOnly
      ? [
        {
          type: 'module',
          dangerouslySetInnerHTML: {
            __html: `
              import _ from "/static/${routeHash}.js";
              _(${JSON.stringify(hydrationData)});
            `,
          },
        },
      ]
      : [];

    if (executionContext.isDev && !pageConfig.ssrOnly) {
      scriptsContextValue.push({
        type: 'module',
        src: `/static/hot_reload.js`,
      });
    }

    const linksContextValue: LinksProps[] = [];

    if (!pageConfig.ssrOnly) {
      linksContextValue.push({
        rel: 'preload',
        as: 'script',
        href: `/static/${routeHash}.js`,
        crossOrigin: 'anonymous',
      });
    }

    const headReplacing = `@@${createHash(8)}@@`;

    const headContextValue: VNode[] = [];
    if (resultMetadata) {
      headContextValue.push(resultMetadata);
    }

    let headHasBeenRendered = false;

    const nonce = csp ? createHash(32) : undefined;

    // deno-lint-ignore no-explicit-any
    let envVarsScripts: VNode<any> | null = null;
    if (Object.keys(clientEnv).length > 0) {
      envVarsScripts = h('script', {
        nonce,
        dangerouslySetInnerHTML: {
          __html: `
          function d(n,v){Object.defineProperty(globalThis,n,{value:v,writable:0})};
          ${
            clientEnv.map(({ hashedKey, value }) => {
              return `d(${JSON.stringify(hashedKey)}, ${
                JSON.stringify(value)
              });`;
            }).join('')
          }
        `,
        },
      });
    }

    // Finally page is wrapped within __root component (SSR Only)
    // It includes all the necessary scripts to hydrate the page
    // and it also exposes Metadata and Links render props
    let html = renderToString(
      h(HEAD_CONTEXT.Provider, { value: headContextValue }, [
        h(LINKS_CONTEXT.Provider, { value: linksContextValue }, [
          h(SCRIPTS_CONTEXT.Provider, { value: scriptsContextValue }, [
            h(Root, {
              state: ctx.state,
              Head: ({ children }) => {
                headHasBeenRendered = true;
                return h(Fragment, null, [
                  children,
                  envVarsScripts,
                  headReplacing,
                ]);
              },
              Component: () =>
                h(
                  Fragment,
                  null,
                  [
                    route,
                    !pageConfig.ssrOnly && h(Scripts, { nonce }),
                  ],
                ),
            }),
          ]),
        ]),
      ]),
    );

    if (headHasBeenRendered) {
      html = html.replace(
        headReplacing,
        renderToString(
          h(LINKS_CONTEXT.Provider, { value: linksContextValue }, [
            h(Links, null),
            headContextValue,
          ]),
        ),
      );
    }

    const res = ok(`<!DOCTYPE html>${html}`, 'html');

    if (csp) {
      res.headers.set(
        'Content-Security-Policy',
        `script-src 'self' 'nonce-${nonce}'; base-uri 'self'; object-src 'none';`,
      );
    }

    return res;
  };

  // Push last handler, which creates the response
  if (loader) {
    // If loader exists, it must call ctx.render method passing the expected data
    handlers.push(() => {
      ctx.render = renderRoute;
      return loader({ req, params, ctx });
    });
  } else {
    // Otherwise, we trigger the renderRoute function with undefined as data
    // It's supposed to be undefined as there is no loader
    handlers.push(() => {
      ctx.render = renderRoute;
      return ctx.render(null);
    });
  }

  return ctx.next();
}
