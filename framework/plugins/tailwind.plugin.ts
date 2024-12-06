import { Plugin } from './core/types.ts';
import tailwindCss, { type Config } from 'tailwindcss';
import postcss from 'postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import * as colors from '@std/fmt/colors';
import { expandGlob } from '@std/fs/expand-glob';
import { EOL } from '@std/fs/eol';
import { join } from '@std/path/join';
import { withTempFile } from '../utils/with_temp_file.ts';
import { toFileUrl } from '@std/path/to-file-url';
import { relative } from '@std/path/relative';
import { dirname } from '@std/path/dirname';

const OUT_FILE_NAME = 'styles.css';

const resolveInCwd = (path: string) => join(Deno.cwd(), path);

async function readConfigFile(path: string): Promise<Config> {
  const mod = await import(toFileUrl(path).href);
  const config = mod.default as Config;

  if (Array.isArray(config.content)) {
    config.content = config.content.map((entry) => {
      if (typeof entry === 'string') {
        const baseDir = relative(Deno.cwd(), dirname(path));
        return join(baseDir, entry);
      }
      return entry;
    });
  }

  return mod.default as Config;
}

async function readFiles(include: string[]): Promise<string> {
  let result = '';

  for (const expr of include) {
    for await (const file of expandGlob(expr)) {
      result += EOL + await Deno.readTextFile(file.path);
    }
  }

  return result;
}

async function bundleStyles(
  {
    config,
    opts,
    content,
  }: {
    content: string;
    config: Config;
    opts?: { mode: 'development' | 'production' };
  },
): Promise<string> {
  const { mode = 'development' } = opts ?? {};

  const plugins = [
    // deno-lint-ignore no-explicit-any
    tailwindCss(config) as any,
    // deno-lint-ignore no-explicit-any
    autoprefixer() as any,
  ];

  if (mode === 'production') {
    plugins.push(cssnano());
  }

  const processor = postcss(plugins);

  const result = await processor.process(
    content,
    {
      from: 'source.css',
      to: OUT_FILE_NAME,
    },
  );
  return result.css;
}

export type PluginTailwindOptions = {
  configFile: string;
  include: string[];
  mode?: 'development' | 'production';
  outFile?: string;
};

export const PluginTailwind: (opts: PluginTailwindOptions) => Plugin = (
  opts,
) => {
  const { mode = 'production', configFile, outFile = OUT_FILE_NAME } = opts ??
    {};

  if (outFile.length === 0) {
    throw new TypeError('The outFile option must be a non-empty string');
  }

  return {
    name: 'sloth-tailwind',
    setup: async (builder) => {
      builder.wg.add(1);
      try {
        const config = await readConfigFile(resolveInCwd(configFile));
        const content = await readFiles(opts.include);
        await withTempFile(async (tempFile) => {
          const result = await bundleStyles({
            config,
            content,
            opts: { mode },
          });
          await Deno.writeTextFile(tempFile, result);
          await builder.copyStaticAsset(tempFile, outFile);
        });
        console.log(colors.green(`✔️ CSS bundling process succeeded`));
      } catch (error) {
        console.log(colors.red(`⨯ CSS bundling process failed\n`), error);
      } finally {
        builder.wg.done();
      }
    },
  };
};
