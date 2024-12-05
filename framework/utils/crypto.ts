import { encodeHex } from '@std/encoding';

export function createHash(length = 10) {
  return encodeHex(crypto.getRandomValues(new Uint8Array(length)));
}
