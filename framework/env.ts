import { md5 } from './utils/crypto.ts';

const ENV_VARS_PREFIX = 'SLOTH_ENV_';

type ObfuscatedEnv = Array<{
  key: string;
  hashedKey: string;
  value: string;
}>;

export const hashEnvKey = async (key: string) => '$' + (await md5(key));

async function getEnv(): Promise<ObfuscatedEnv> {
  const result: ObfuscatedEnv = [];
  const env = Deno.env.toObject();
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(ENV_VARS_PREFIX)) {
      const hashedKey = await hashEnvKey(key);
      result.push({ key, hashedKey, value });
    }
  }
  return result;
}

export const clientEnv = await getEnv();

for (const { key, value } of clientEnv) {
  // @ts-expect-error this is fine
  globalThis[key] = value;
}
