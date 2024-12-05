import tailwindCss, { type Config } from 'tailwindcss';
import postcss from 'postcss';
import cssnano from 'cssnano';
import autoprefixer from 'autoprefixer';
import { exists, walk } from '@std/fs';
import * as colors from '@std/fmt/colors';
import { FsContext } from '../lib/fs_context.ts';
import { dirname, join, relative, toFileUrl } from '@std/path';

// TODO: Decouple from main logic. Plugin system?
export async function bundleStyles(
  fsContext: FsContext,
  opts?: { mode: 'development' | 'production' },
) {
  const { mode = 'development' } = opts ?? {};

  let tailwindConfigPath: string | undefined;
  for await (
    const entry of walk(fsContext.resolvePath('.'), {
      match: [/tailwind.config.(j|t)s/i],
    })
  ) {
    tailwindConfigPath = entry.path;
    break;
  }

  if (!tailwindConfigPath) {
    throw new Error('tailwind config file was not found');
  }

  const indexCssPath = fsContext.resolvePath('index.css');

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

  const outFile = fsContext.resolveFromOutDir('static', 'styles.css');

  try {
    const result = await processor.process(
      content,
      {
        from: 'index.css',
        to: 'styles.css',
      },
    );
    await Deno.writeTextFile(outFile, result.css);
    console.log(colors.green(`✔️ CSS bundling process succeeded`));
  } catch (err) {
    console.log(colors.red(`⨯ CSS bundling process failed\n`), err);
  }
}
