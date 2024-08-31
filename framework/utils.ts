import type { Manifest } from "./types.ts";
import { fromFileUrl, resolve } from "@std/path";

export function isFileUrl(url: string | URL) {
  return url.toString().startsWith("file://");
}

export function resolveFromBaseUrl(
  baseUrl: Manifest["baseUrl"],
  ...segments: string[]
): string {
  const basePath = isFileUrl(baseUrl) ? fromFileUrl(baseUrl) : baseUrl;
  return resolve(basePath, ...segments);
}

export const IS_BROWSER = typeof window !== "undefined";
