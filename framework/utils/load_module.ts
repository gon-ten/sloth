import { isAbsolute, toFileUrl } from '@std/path';

const moduleCache = new Map();

export async function loadModule<T>(
  path: string,
  options?: ImportCallOptions,
): Promise<T> {
  if (moduleCache.has(path)) {
    return moduleCache.get(path);
  }
  const modFileUrl = isAbsolute(path) ? toFileUrl(path).href : path;
  if (!modFileUrl.startsWith('file://')) {
    throw new TypeError(`${path} is not an absulote or file url`);
  }
  const mod = await import(modFileUrl, options);
  moduleCache.set(path, mod);
  return mod;
}
