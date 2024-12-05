import { SEPARATOR } from '@std/path/constants';

export async function withTmpDirectory(
  callback: (tmpDir: string) => void | Promise<void>,
) {
  let tmpDir = await Deno.makeTempDir();
  if (!tmpDir.endsWith(SEPARATOR)) {
    tmpDir += SEPARATOR;
  }
  try {
    await callback(tmpDir);
  } catch (err) {
    throw err;
  } finally {
    await Deno.remove(tmpDir, { recursive: true }).catch(() => null);
  }
}
