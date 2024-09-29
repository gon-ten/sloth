import { exists } from "@std/fs";
import * as colors from "@std/fmt/colors";
import * as esbuild from "esbuild";
import { denoPlugins } from "@luca/esbuild-deno-loader";
import { FsContext } from "../server/fs_context.ts";
import { createDirectoryIfNotExists } from "../utils/fs.ts";

export async function bundleStyles(fsContext: FsContext) {
  const tailwindConfigPath = fsContext.resolvePath("tailwind.config.js");

  const result = await esbuild.build({
    plugins: [
      ...denoPlugins({
        configPath: fsContext.resolvePath("./deno.json"),
      }),
    ],
    entryPoints: [tailwindConfigPath],
    write: false,
    bundle: true,
    target: "es2022",
    format: "esm",
  });

  const [outputFile] = result.outputFiles;

  await createDirectoryIfNotExists(fsContext.resolveFromOutDir("config"));

  const tailwindConfigBundledPath = fsContext.resolveFromOutDir(
    "config",
    "tailwind.config.cooked.js"
  );
  await Deno.writeFile(tailwindConfigBundledPath, outputFile.contents);

  const indexCssPath = fsContext.resolvePath("index.css");

  let inputArg: string[] = [];
  const indexCssExists = await exists(indexCssPath);
  if (indexCssExists) {
    inputArg = ["-i", indexCssPath];
  }

  const outFile = fsContext.resolveFromOutDir("static", "styles.css");

  const cssCmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-ffi",
      "--allow-sys",
      "--allow-env",
      "--allow-write",
      "--allow-read",
      "npm:tailwindcss@^3.4.1",
      "-c",
      tailwindConfigBundledPath,
      ...inputArg,
      "-o",
      outFile,
    ],
    stdout: "piped",
    stderr: "piped",
    cwd: fsContext.resolvePath("."),
  });

  const cp = cssCmd.spawn();
  const { success, stderr } = await cp.output();

  if (!success) {
    console.warn(
      colors.red(`⨯ CSS bundling process failed. Reason:`),
      new TextDecoder().decode(stderr)
    );
  } else {
    console.log(colors.green(`✔️ CSS bundling process succeeded`));
  }
}
