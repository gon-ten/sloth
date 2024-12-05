import type { Route } from '@std/http';
import type { FsContext } from '../lib/fs_context.ts';
import { exists } from '@std/fs/exists';
import { loadModule } from '../utils/load_module.ts';
import type { RobotsModule } from '../types.ts';
import { withHeadSupport } from './index.ts';

export async function createRobotsRoute(
  fsContext: FsContext,
): Promise<Route | undefined> {
  const filePath = fsContext.resolvePath('robots.ts');
  const robotsExists = await exists(filePath);

  if (!robotsExists) {
    return;
  }

  const mod = await loadModule<RobotsModule>(filePath);

  if (typeof mod.default !== 'function') {
    throw new Error(
      'robots.ts expects a function exported as default. Add it or remove robots.ts file',
    );
  }

  return {
    method: ['GET', 'HEAD'],
    pattern: new URLPattern({ pathname: '/robots.txt' }),
    handler: withHeadSupport((req) => mod.default(req)),
  };
}
