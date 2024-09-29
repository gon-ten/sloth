import * as colors from "@std/fmt/colors";
import { FsContext } from "./fs_context.ts";
import { type Handler, route, type Route, serveDir } from "@std/http";
import { CollectionNotFoundError } from "../errors.ts";
import { internalServerError, notFound } from "./http_responses.ts";

const DEFAULT_PORT = 3443;

export function initServer({
  fsContext,
  routes,
  defaultHandler,
}: {
  fsContext: FsContext;
  routes: Route[];
  defaultHandler: Handler;
}): void {
  console.log(colors.bgBrightBlue("initializing server"));

  const onListen: Deno.ServeOptions<Deno.NetAddr>["onListen"] = (addr) => {
    const fullAddr = colors.cyan(`http://localhost:${addr.port}`);
    console.log(`\n\t🦥 Sloth Server running at ${fullAddr}\n`);
  };

  const onError: Deno.ServeOptions["onError"] = (error) => {
    console.log(`\n${colors.red("An error ocurred:")}\n\n`);
    console.log(error);
    if (error instanceof CollectionNotFoundError) {
      return notFound();
    }
    return internalServerError();
  };

  const coreHandler = route(
    [
      {
        method: "GET",
        pattern: new URLPattern({ pathname: "/favicon.ico" }),
        handler: notFound,
      },
      {
        method: "GET",
        pattern: new URLPattern({ pathname: "/static/*" }),
        handler: (req) =>
          serveDir(req, {
            fsRoot: fsContext.resolveFromOutDir("static"),
            urlRoot: "static/",
            showIndex: false,
          }),
      },
      ...routes,
    ],
    defaultHandler
  );

  const server = Deno.serve(
    {
      port: Deno.env.has("PORT") ? +Deno.env.get("PORT")! : DEFAULT_PORT,
      onListen,
      onError,
    },
    (req, info) => {
      const url = new URL(req.url);
      if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.slice(0, -1);
        return Response.redirect(url, 307);
      }
      return coreHandler(req, info);
    }
  );

  server.finished.then(() => {
    console.log(colors.yellow(`Server finished`));
  });
}
