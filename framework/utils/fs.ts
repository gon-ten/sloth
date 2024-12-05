import { exists } from '@std/fs';
import { extname, SEPARATOR, SEPARATOR_PATTERN } from '@std/path';
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

export function fsPathToRoutePattern(
  routePath: string,
): { pattern: string; deep: number } {
  const parts = fileNameWithNoExt(routePath).split(SEPARATOR_PATTERN).filter(
    Boolean,
  );

  for (let index = 0, L = parts.length; index < L; index++) {
    const part = parts[index];

    if (index === parts.length - 1) {
      if (part === 'index') {
        parts.splice(index);
        break;
      }
    }

    if (part.includes('][')) {
      throw new Error(
        `Path must not contain multiple parameters without a separator. At: ${routePath}`,
      );
    }

    if (part.startsWith('[...') && part.endsWith(']')) {
      const paramName = part.slice(4, -1);
      parts[index] = `:${paramName}*`;
      parts.splice(index + 1);
      break;
    }

    if (part.includes('[') && !part.includes(']')) {
      throw new Error(`No ending bracket found at ${routePath}`);
    }

    if (part.includes('[') && part.includes(']')) {
      let paramName = '';
      let partCopy = part;
      let currentChar = '';

      while (partCopy.length) {
        currentChar = partCopy[0];
        partCopy = partCopy.slice(1);

        if (currentChar === '[') {
          const closingBracketPosition = partCopy.indexOf(']');
          const nextOpeningBracketPosition = partCopy.indexOf('[');

          if (closingBracketPosition === -1) {
            throw new Error(`No ending bracket found at ${routePath}`);
          }

          if (
            nextOpeningBracketPosition !== -1 &&
            nextOpeningBracketPosition < closingBracketPosition
          ) {
            throw new Error(
              `Opening bracket found before closing bracket at ${routePath}`,
            );
          }

          paramName += `:${partCopy.slice(0, closingBracketPosition)}`;
          partCopy = partCopy.slice(closingBracketPosition + 1);
        } else {
          paramName += currentChar;
        }
      }

      parts[index] = paramName;
      continue;
    }
  }

  return {
    pattern: '/' + parts.join('/'),
    deep: parts.length,
  };
}
