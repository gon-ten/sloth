import { assertEquals, assertRejects } from '@std/assert';
import { describe, test } from '@std/testing/bdd';
import { Builder } from './builder.ts';
import { FsContext } from '../../lib/fs_context.ts';
import { withTmpDirectory } from '../../utils/testing.ts';
import { join } from '@std/path/join';
import { exists } from '@std/fs/exists';

const newBuilder = (baseUrl: string) =>
  new Builder(
    new FsContext(baseUrl),
  );

describe('Builder', () => {
  describe('#copyStaticAsset', () => {
    test('should copy file to out dir', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const builder = newBuilder(tmpDir);
        const tmpFile = await Deno.makeTempFile({
          dir: tmpDir,
          prefix: 'source_',
        });
        await builder.copyStaticAsset(tmpFile, 'test/destination.txt');
        const expectedFilePath = join(
          tmpDir,
          '/.cooked/static/',
          'test/destination.txt',
        );
        assertEquals(await exists(expectedFilePath), true);
      });
    });

    test('relative paths should not escape from static dir', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const builder = newBuilder(tmpDir);
        const tmpFile = await Deno.makeTempFile({
          dir: tmpDir,
          prefix: 'source_',
        });
        await builder.copyStaticAsset(
          tmpFile,
          '../.././test/destination.txt',
        );
        const expectedFilePath = join(
          tmpDir,
          '/.cooked/static/',
          'test/destination.txt',
        );
        assertEquals(await exists(expectedFilePath), true);
      });
    });

    test('should throw an Error when destination file already exists', async () => {
      await withTmpDirectory(async (tmpDir) => {
        const builder = newBuilder(tmpDir);
        const tmpFile = await Deno.makeTempFile({
          dir: tmpDir,
          prefix: 'source_',
        });
        await builder.copyStaticAsset(tmpFile, 'test/destination.txt');
        assertRejects(
          () => builder.copyStaticAsset(tmpFile, 'test/destination.txt'),
          'already exists, please use another path or filename',
        );
      });
    });

    test('should throw a TypeError when fromPath or toPath are empty strings', async () => {
      await withTmpDirectory((tmpDir) => {
        const builder = newBuilder(tmpDir);
        assertRejects(() =>
          builder.copyStaticAsset('', 'test/destination.txt')
        );
        assertRejects(
          () => builder.copyStaticAsset('source.txt', ''),
          'toPath can not be an empty string',
        );
      });
    });

    test('should throw an Error when toPath already exists', async () => {
      await withTmpDirectory((tmpDir) => {
        const builder = newBuilder(tmpDir);
        assertRejects(
          () => builder.copyStaticAsset('source.txt', 'test/destination.txt'),
          'fromPath can not be an empty string',
        );
      });
    });
  });
});
