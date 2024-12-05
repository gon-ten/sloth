import { contentType } from '@std/media-types';
import { STATUS_CODE, STATUS_TEXT } from '@std/http';

export function internalServerError(): Response {
  const statusCode = STATUS_CODE.InternalServerError;
  const statusText = STATUS_TEXT[statusCode];
  return new Response(statusText, {
    status: statusCode,
    statusText: statusText,
    headers: {
      'content-type': contentType('text'),
    },
  });
}

export function notFound(): Response {
  const statusCode = STATUS_CODE.NotFound;
  const statusText = STATUS_TEXT[statusCode];
  return new Response(statusText, {
    status: statusCode,
    statusText: statusText,
    headers: {
      'content-type': contentType('text'),
    },
  });
}

export function badRequest(body?: BodyInit): Response {
  const statusCode = STATUS_CODE.BadRequest;
  const statusText = STATUS_TEXT[statusCode];
  return new Response(body != null ? JSON.stringify(body) : null, {
    status: statusCode,
    statusText: statusText,
    headers: {
      'content-type': contentType('text'),
    },
  });
}

export function ok(
  body: BodyInit | null,
  ct: Parameters<typeof contentType>[0] = 'text',
): Response {
  const statusCode = STATUS_CODE.OK;
  const statusText = STATUS_TEXT[statusCode];
  return new Response(body, {
    status: statusCode,
    statusText: statusText,
    headers: {
      'content-type': contentType(ct) ??
        contentType('application/octet-stream'),
    },
  });
}
