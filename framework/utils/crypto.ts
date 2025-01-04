import { encodeHex } from '@std/encoding';
import { crypto } from '@std/crypto/crypto';

export function createHash(length = 10) {
  return encodeHex(crypto.getRandomValues(new Uint8Array(length)));
}

const textEncoder = new TextEncoder();

export async function md5(data: string) {
  const hash = await crypto.subtle.digest(
    'MD5',
    textEncoder.encode(data),
  );
  return encodeHex(new Uint8Array(hash));
}
