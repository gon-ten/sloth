import { toFileUrl } from "@std/path/to-file-url";
import { FsContext } from "./fs_context.ts";
import { assertEquals, assertThrows } from "@std/assert";

Deno.test("FsContenxt", async (t) => {
  const absBaseUrl = "/test/base/url/";

  await t.step("resolves path", () => {
    const fsContext = new FsContext({
      baseUrl: absBaseUrl,
    });
    assertEquals(fsContext.resolvePath("foo", "bar"), `${absBaseUrl}foo/bar`);
  });

  await t.step("resolves path from file URL", () => {
    const fsContext = new FsContext({
      baseUrl: toFileUrl(absBaseUrl).href,
    });
    assertEquals(fsContext.resolvePath("foo", "bar"), `${absBaseUrl}foo/bar`);
  });

  await t.step("getAppRoot returns expected path", () => {
    const fsContext = new FsContext({
      baseUrl: absBaseUrl,
    });
    assertEquals(fsContext.getAppRoot(), `${absBaseUrl}__root.tsx`);
  });

  await t.step("resolveFromOutDir returns expected path", () => {
    const fsContext = new FsContext({
      baseUrl: absBaseUrl,
    });
    assertEquals(
      fsContext.resolveFromOutDir("dist"),
      `${absBaseUrl}.cooked/dist`
    );
  });

  await t.step("resolveRoute returns expected path", () => {
    const fsContext = new FsContext({
      baseUrl: absBaseUrl,
    });
    assertEquals(fsContext.resolveRoute("test"), `${absBaseUrl}routes/test`);
  });

  await t.step(
    "should throw an error when path is not absolute or file url",
    () => {
      assertThrows(() => {
        new FsContext({
          baseUrl: "./relative/path",
        });
      });
    }
  );
});
