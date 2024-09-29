import { exists } from '@std/fs';
import { extname, SEPARATOR } from '@std/path';
import { crypto } from '@std/crypto/crypto';
import { toReadableStream } from '@std/io';

export async function checksum(filePath: string): Promise<string> {
  using file = await Deno.open(filePath);
  const hashBuffer = await crypto.subtle.digest('MD5', toReadableStream(file));
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function fileNameWithNoExt(fileName: string) {
  return fileName.slice(0, -extname(fileName).length);
}

export async function createDirectoryIfNotExists(path: string) {
  if (!path.endsWith(SEPARATOR)) {
    path += SEPARATOR;
  }
  const dirExists = await exists(path, { isDirectory: true });
  if (dirExists) {
    return;
  }
  await Deno.mkdir(path, { recursive: true });
}
