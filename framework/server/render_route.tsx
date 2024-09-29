import type {
  RouteImportMapEntry,
  LoaderModule,
  PageProps,
  LayoutModule,
  RootModule,
  PageModule,
  MiddlewareModule,
  MetadataModule,
  RouteConfig,
} from "../types.ts";
import type { VNode } from "preact";
import type { FsContext } from "./fs_context.ts";
import {
  DATA_ROLE_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from "../shared/constants.ts";
import { prerender } from "preact-iso";
import { STATUS_CODE, STATUS_TEXT } from "@std/http";
import { contentType } from "@std/media-types";
import { loadModule } from "../utils/mod_cache.ts";
import "../shared/option_hooks.ts";
import { deepMerge } from "@std/collections";

const defaultConfig: RouteConfig = {
  skipInheritedLayouts: false,
};

export async function renderRoute({
  context,
  importMap,
  request,
  params: rawParams,
}: {
  context: FsContext;
  importMap: RouteImportMapEntry;
  request: Request;
  params?: URLPatternResult;
}): Promise<Response> {
  const appRootPath = context.getAppRoot();

  const [RootModule, PageModule] = await Promise.all([
    loadModule<RootModule>(appRootPath),
    loadModule<PageModule>(importMap.component),
  ]);

  const { default: Root } = RootModule;
  const { default: Page, config = {} } = PageModule;
  const fullConfig: RouteConfig = deepMerge(defaultConfig, config);

  const params: Record<string, string> = rawParams
    ? (Object.fromEntries(
        Object.entries(rawParams.pathname.groups).filter(
          ([, value]) => typeof value !== "undefined"
        )
      ) as Record<string, string>)
    : {};

  let routeData: unknown;
  if (importMap.loader) {
    const { default: loader } = await loadModule<LoaderModule>(
      importMap.loader
    );
    routeData = await loader({ request, params });
  }

  const metadata: VNode[] = [];
  if (importMap.metadata) {
    const mod = await loadModule<MetadataModule>(importMap.metadata);
    const { title, description } = mod.default;

    // TODO: make it scalable
    if (title) {
      metadata.push(<title key="title">{title}</title>);
    }

    if (description) {
      metadata.push(
        <meta key="description" name="description" content={description} />
      );
    }
  }

  const url = new URL(request.url);

  const dataMap: Record<string, PageProps> = {
    [importMap.hash]: {
      data: routeData,
      url: url.pathname,
      params,
    },
  };

  let layouts: Array<{
    module: LayoutModule;
    hash: string;
  }> = [];

  if (importMap.interceptors.length > 0) {
    for (const { hash, middleware, layout } of importMap.interceptors) {
      if (middleware) {
        const { handler } = await loadModule<MiddlewareModule>(middleware);
        if (handler) {
          const result = await handler(request);
          if (result instanceof Response) {
            return result;
          }
        }
      }

      if (layout) {
        const layoutModule = await loadModule<LayoutModule>(layout);
        const { loader } = layoutModule;
        layouts = [{ module: layoutModule, hash }].concat(layouts);
        let data: unknown;
        if (loader) {
          data = await loader({ request, params });
        }
        dataMap[hash] = {
          data,
          url: url.pathname,
          params,
        };
      }
    }
  }

  let route = <Page {...dataMap[importMap.hash]} />;
  if (!fullConfig.skipInheritedLayouts) {
    route = layouts.reduce((acc, { hash, module }) => {
      const LayoutComponent = module.default;
      if (!LayoutComponent) {
        return acc;
      }
      return <LayoutComponent {...dataMap[hash]}>{acc}</LayoutComponent>;
    }, route);
  }

  let { html } = await prerender(
    <Root
      Metadata={() => <>{metadata}</>}
      links={[<link rel="stylesheet" href="/static/styles.css" />]}
    >
      <>
        {route}
        <script
          type={HYDRATION_SCRIPT_TYPE}
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(dataMap),
          }}
          {...{ [DATA_ROLE_ATTRIBUTE]: "main" }}
        ></script>
        <script
          src={`/static/hydrate_${importMap.hash}.js`}
          type="module"
        ></script>
        <script type="isodata"></script>
      </>
    </Root>
  );

  if (html.endsWith('<script type="isodata"></script>')) {
    html = html.slice(0, -32);
  }

  const content = `<!DOCTYPE html>${html}`;

  return new Response(content, {
    status: STATUS_CODE.OK,
    statusText: STATUS_TEXT[STATUS_CODE.OK],
    headers: {
      "content-type": contentType("html"),
    },
  });
}
