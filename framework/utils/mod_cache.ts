const moduleCache = new Map();

export async function loadModule<T>(path: string): Promise<T> {
  if (moduleCache.has(path)) {
    return moduleCache.get(path);
  }
  const mod = await import(path);
  moduleCache.set(path, mod);
  return mod;
}
