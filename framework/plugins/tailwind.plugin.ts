import { Plugin } from './core/types.ts';
import tailwindCss, { type Config } from 'tailwindcss';
import postcss from 'postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import { exists, walk } from '@std/fs';
import * as colors from '@std/fmt/colors';
import { dirname, join, relative, toFileUrl } from '@std/path';

const resolveInCwd = (path: string) => join(Deno.cwd(), path);

async function bundleStyles(
  opts?: { mode: 'development' | 'production' },
): Promise<string | undefined> {
  const { mode = 'development' } = opts ?? {};

  let tailwindConfigPath: string | undefined;

  for await (
    const entry of walk(resolveInCwd('.'), {
      match: [/tailwind.config.(j|t)s/i],
    })
  ) {
    tailwindConfigPath = entry.path;
    break;
  }

  if (!tailwindConfigPath) {
    throw new Error('tailwind config file was not found');
  }

  const indexCssPath = resolveInCwd('index.css');

  let content: string = '';

  const indexCssExists = await exists(indexCssPath);
  if (indexCssExists) {
    content = await Deno.readTextFile(indexCssPath);
  } else {
    content = `
      @tailwind base;
      @tailwind components;
      @tailwind utilities;
    `;
  }

  const config = (await import(toFileUrl(tailwindConfigPath).href))
    .default as Config;

  if (Array.isArray(config.content)) {
    config.content = config.content.map((entry) => {
      if (typeof entry === 'string') {
        const baseDir = relative(Deno.cwd(), dirname(tailwindConfigPath));
        return join(baseDir, entry);
      }
      return entry;
    });
  }

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

  try {
    const outFile = await Deno.makeTempFile();
    const result = await processor.process(
      content,
      {
        from: 'index.css',
        to: 'styles.css',
      },
    );
    await Deno.writeTextFile(outFile, result.css);
    console.log(colors.green(`✔️ CSS bundling process succeeded`));
    return outFile;
  } catch (err) {
    console.log(colors.red(`⨯ CSS bundling process failed\n`), err);
  }
}

export type PluginTailwindOptions = {
  mode?: 'development' | 'production';
};

export const PluginTailwind: (opts?: PluginTailwindOptions) => Plugin = (
  opts,
) => {
  const { mode = 'production' } = opts ?? {};
  return {
    name: 'sloth-tailwind',
    setup: async (builder) => {
      builder.wg.add(1);
      try {
        const outFile = await bundleStyles({ mode });
        if (outFile) {
          await builder.copyStaticAsset(outFile, 'styles.css');
        }
      } catch (error) {
        console.error('Error in tailwind plugin', error);
      } finally {
        builder.wg.done();
      }
    },
  };
};
