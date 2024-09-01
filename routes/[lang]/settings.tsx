import { RouteHandlers } from "@gdiezpa/blog";

export const handler: RouteHandlers = {
  GET() {
    return Response.json({
      req: "GET /:lang/settings",
    });
  },
};

export default function Settings() {
  return <div>Settings</div>;
}
