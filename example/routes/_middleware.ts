import { THEME_COOKIE_NAME, THEMES, ThemeValue } from '@/🛠️/theme.ts';
import { deleteCookie } from '@std/http/cookie';
import type { AppMiddleware } from '../types.ts';
import { getCookies } from '@std/http/cookie';
import * as v from '@valibot/valibot';

const themeCookieSchema = v.optional(
  v.pipe(v.string(), v.trim(), v.picklist(THEMES)),
);

export async function getThemeFromRequest(
  req: Request,
): Promise<ThemeValue | undefined> {
  const cookies = getCookies(req.headers);
  try {
    return await v.parseAsync(themeCookieSchema, cookies.theme);
  } catch (err) {
    throw err;
  }
}

export const handler: AppMiddleware = async ({ req, ctx }) => {
  const url = new URL(req.url);

  if (url.pathname === '/') {
    return new Response(null, {
      status: 307,
      statusText: 'Temporary Redirect',
      headers: {
        location: '/en',
      },
    });
  }

  try {
    const theme = await getThemeFromRequest(req);
    ctx.state = { theme: theme ?? 'light' };
  } catch {
    const headers = new Headers();
    deleteCookie(headers, THEME_COOKIE_NAME);
    return new Response('Bad Request', {
      status: 400,
      statusText: 'Bad Request',
      headers,
    });
  }

  return ctx.next();
};
