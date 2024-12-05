import { describe, test } from '@std/testing/bdd';
import {
  checksum,
  createDirectoryIfNotExists,
  fsPathToRoutePattern,
} from './fs.ts';
import { join } from '@std/path/join';
import { assertSpyCalls, stub } from '@std/testing/mock';
import { withTmpDirectory } from './testing.ts';
import { assertEquals, assertThrows } from '@std/assert';

describe('fs utils', () => {
  describe('fsPathToRoutePattern', () => {
    test('should convert paths to expected patterns', () => {
      assertEquals(fsPathToRoutePattern('/index.tsx'), {
        pattern: '/',
        deep: 0,
      });
      assertEquals(fsPathToRoutePattern('/[param].tsx'), {
        pattern: '/:param',
        deep: 1,
      });
      assertEquals(fsPathToRoutePattern('/[...slug].tsx'), {
        pattern: '/:slug*',
        deep: 1,
      });
      assertEquals(
        fsPathToRoutePattern('/foo/bar/baz.tsx'),
        { pattern: '/foo/bar/baz', deep: 3 },
      );
      assertEquals(
        fsPathToRoutePattern('/foo/[bar]/[baz].tsx'),
        { pattern: '/foo/:bar/:baz', deep: 3 },
      );
      assertEquals(
        fsPathToRoutePattern('/foo/[bar]/[...baz].tsx'),
        { pattern: '/foo/:bar/:baz*', deep: 3 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar].tsx'),
        { pattern: '/:foo-:bar', deep: 1 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/baz.tsx'),
        { pattern: '/:foo-:bar/baz', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/baz/index.tsx'),
        { pattern: '/:foo-:bar/baz', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/[baz].tsx'),
        { pattern: '/:foo-:bar/:baz', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/[baz]/index.tsx'),
        { pattern: '/:foo-:bar/:baz', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/[...baz].tsx'),
        { pattern: '/:foo-:bar/:baz*', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/[foo]-[bar]/[...baz]/index.tsx'),
        { pattern: '/:foo-:bar/:baz*', deep: 2 },
      );
      assertEquals(
        fsPathToRoutePattern('/@[foo]-[bar].tsx'),
        { pattern: '/@:foo-:bar', deep: 1 },
      );
    });

    test('should throw an error', () => {
      assertThrows(
        () => fsPathToRoutePattern('[param1][param2].ts'),
        'Path must not contain multiple parameters without a separator',
      );
      assertThrows(
        () => fsPathToRoutePattern('[param1[param2].ts'),
        'Opening bracket found before closing bracket',
      );
      assertThrows(
        () => fsPathToRoutePattern('[param1]-[param2.ts'),
        'No ending bracket found',
      );
      assertThrows(
        () => fsPathToRoutePattern('[param1.ts'),
        'No ending bracket found',
      );
    });
  });

  describe('createDirectoryIfNotExists', () => {
    test('should create directory if not exists', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const dir = join(tmpDir, '/foo');
        await createDirectoryIfNotExists(dir);
        assertEquals((await Deno.stat(dir)).isDirectory, true);
      });
    });
    test('should create directory if not exists recursively', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const dir = join(tmpDir, '/foo/bar/baz');
        await createDirectoryIfNotExists(dir);
        assertEquals((await Deno.stat(dir)).isDirectory, true);
      });
    });
    test('should not create directory already exists', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const dir = join(tmpDir, '/foo');
        await Deno.mkdir(dir, { recursive: true });
        using mkdirStub = stub(Deno, 'mkdir');
        await createDirectoryIfNotExists(dir);
        assertSpyCalls(mkdirStub, 0);
      });
    });
  });

  describe('checksum', () => {
    test('should create a md5 checksum', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const filePath = join(tmpDir, 'file.txt');
        await Deno.writeTextFile(filePath, 'foo bar baz');
        const hash = await checksum(filePath);
        assertEquals(hash, 'ab07acbb1e496801937adfa772424bf7');
      });
    });
  });
});
