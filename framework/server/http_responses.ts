import { contentType } from "@std/media-types";
import { STATUS_CODE, STATUS_TEXT } from "@std/http";

export function internalServerError(): Response {
  const statusCode = STATUS_CODE["InternalServerError"];
  const statusText = STATUS_TEXT[STATUS_CODE["InternalServerError"]];
  return new Response(statusText, {
    status: statusCode,
    statusText: statusText,
    headers: {
      "content-type": contentType("text"),
    },
  });
}

export function notFound(): Response {
  const statusCode = STATUS_CODE["NotFound"];
  const statusText = STATUS_TEXT[STATUS_CODE["NotFound"]];
  return new Response(statusText, {
    status: statusCode,
    statusText: statusText,
    headers: {
      "content-type": contentType("text"),
    },
  });
}
