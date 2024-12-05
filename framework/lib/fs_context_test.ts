import { toFileUrl } from '@std/path/to-file-url';
import { FsContext } from './fs_context.ts';
import { assertEquals, assertThrows } from '@std/assert';
import { describe, test } from '@std/testing/bdd';

describe('FsContenxt', () => {
  const absBaseUrl = '/test/base/url/';

  test('resolves path', () => {
    const fsContext = new FsContext(
      absBaseUrl,
    );
    assertEquals(fsContext.resolvePath('foo', 'bar'), `${absBaseUrl}foo/bar`);
  });

  test('resolves path from file URL', () => {
    const fsContext = new FsContext(
      toFileUrl(absBaseUrl).href,
    );
    assertEquals(fsContext.resolvePath('foo', 'bar'), `${absBaseUrl}foo/bar`);
  });

  test('getAppRoot returns expected path', () => {
    const fsContext = new FsContext(
      absBaseUrl,
    );
    assertEquals(fsContext.getAppRoot(), `${absBaseUrl}__root.tsx`);
  });

  test('resolveFromOutDir returns expected path', () => {
    const fsContext = new FsContext(
      absBaseUrl,
    );
    assertEquals(
      fsContext.resolveFromOutDir('dist'),
      `${absBaseUrl}.cooked/dist`,
    );
  });

  test('resolveRoute returns expected path', () => {
    const fsContext = new FsContext(
      absBaseUrl,
    );
    assertEquals(fsContext.resolveRoute('test'), `${absBaseUrl}routes/test`);
  });

  test('should throw an error when path is not absolute or file url', () => {
    assertThrows(() => {
      new FsContext(
        './relative/path',
      );
    });
  });
});
