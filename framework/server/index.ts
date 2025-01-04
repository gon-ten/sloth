import * as colors from '@std/fmt/colors';
import { FsContext } from '../lib/fs_context.ts';
import {
  type Handler,
  type Route,
  route,
  serveDir,
  STATUS_CODE,
  STATUS_TEXT,
} from '@std/http';
import { CollectionNotFoundError } from '../collections/errors.ts';
import { internalServerError, notFound, ok } from './http_responses.ts';
import { AppConfig, MetaFile } from '../types.ts';
import { composeRoutes } from './routes.ts';
import { createRobotsRoute } from './robots.ts';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { loadCollections } from '../collections/index.ts';

const DEFAULT_PORT = 3443;

export const executionContext = { isDev: false };

function createHotRealoadRoute(): Route {
  const id = crypto.randomUUID();
  return {
    method: 'GET',
    pattern: new URLPattern({ pathname: '/__hot_reload' }),
    handler: (req) => {
      const { socket, response } = Deno.upgradeWebSocket(req, {
        idleTimeout: 60_000,
      });

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence') {
            socket.send(
              JSON.stringify(
                { type: 'ack', payload: { id } },
              ),
            );
          }
        } catch {
          // do nothing
        }
      };

      return response;
    },
  };
}

export function withHeadSupport(
  handler: Handler,
): Handler {
  return async (req, serverInfo, params) => {
    const res = await handler(req, serverInfo, params);

    if (req.method.toUpperCase() === 'HEAD') {
      res.body?.cancel();
      return new Response(null, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    }

    return res;
  };
}

export function initServer({
  fsContext,
  routes,
  defaultHandler,
}: {
  fsContext: FsContext;
  routes: Route[];
  defaultHandler: Handler;
}): void {
  console.log(colors.bgBrightBlue('initializing server'));

  const onListen = (addr: Deno.NetAddr) => {
    const fullAddr = colors.cyan(`http://localhost:${addr.port}`);
    console.log(`\n\t🦥 Sloth Server running at ${fullAddr}\n`);
  };

  const onError = (error: unknown) => {
    console.log(`\n${colors.red('An error ocurred:')}\n\n`);
    console.log(error);
    if (error instanceof CollectionNotFoundError) {
      return notFound();
    }
    return internalServerError();
  };

  const allRoutes = [
    {
      method: ['GET', 'HEAD'],
      pattern: new URLPattern({ pathname: '/favicon.ico' }),
      handler: notFound,
    },
    {
      method: ['GET', 'HEAD'],
      pattern: new URLPattern({ pathname: '/static/*' }),
      handler: withHeadSupport(
        async (req) => {
          const res = await serveDir(req, {
            fsRoot: fsContext.resolveFromOutDir('static'),
            urlRoot: 'static/',
            showIndex: false,
            quiet: true,
            headers: ['Cache-Control: no-cache'],
          });
          res.headers.delete('server');
          return res;
        },
      ),
    },
    ...routes,
  ];

  if (executionContext.isDev) {
    const debugRoute = createDebugRoute(allRoutes);
    allRoutes.unshift(createHotRealoadRoute(), debugRoute);
  }

  const coreHandler = route(
    allRoutes,
    defaultHandler,
  );

  const server = Deno.serve(
    {
      hostname: '0.0.0.0',
      port: Deno.env.has('PORT') ? +Deno.env.get('PORT')! : DEFAULT_PORT,
      onListen,
      onError,
    },
    (req, info) => {
      const url = new URL(req.url);
      if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
        return new Response(
          null,
          {
            status: STATUS_CODE['TemporaryRedirect'],
            statusText: STATUS_TEXT[STATUS_CODE['TemporaryRedirect']],
            headers: new Headers({
              location: url.pathname,
            }),
          },
        );
      }
      return coreHandler(req, info);
    },
  );

  server.finished.then(() => {
    console.log(colors.yellow(`Server finished`));
  });
}

export async function start(config: AppConfig) {
  const fsContext = new FsContext(config.importMeta.url);

  const metaFilePath = fsContext.resolveFromOutDir('project', 'meta.json');

  const metaFile: MetaFile = await import(metaFilePath, {
    with: { type: 'json' },
  }).then((res) => res.default);

  const routes = await composeRoutes(
    fsContext,
    metaFile,
  );

  const robotsRoute = await createRobotsRoute(fsContext);

  try {
    await loadCollections({ metaFile });
  } catch (error) {
    console.error('Error loading collections', error);
  }

  initServer({
    fsContext,
    routes: [...(robotsRoute ? [robotsRoute] : []), ...routes],
    defaultHandler: notFound,
  });
}

function createDebugRoute(allRoutes: Route[]): Route {
  return {
    method: ['GET', 'HEAD'],
    pattern: new URLPattern({ pathname: '/__debug' }),
    handler: withHeadSupport(() => {
      return ok(
        renderToString(
          h('table', {}, [
            h('thead', {}, [
              h('tr', {}, [
                h('th', {}, '#'),
                h('th', {}, 'Method'),
                h('th', {}, 'Pattern'),
              ]),
            ]),
            h(
              'tbody',
              {},
              allRoutes.map((route, index) => {
                return h('tr', {}, [
                  h('td', {}, index + 1),
                  h(
                    'td',
                    {},
                    route.method ? JSON.stringify(route.method) : '-',
                  ),
                  h('td', {}, route.pattern.pathname),
                ]);
              }),
            ),
          ]),
        ),
        'html',
      );
    }),
  };
}
