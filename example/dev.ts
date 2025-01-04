import dev from '@sloth/core/dev';
import { config } from './config.ts';
import { PluginTailwind } from '@sloth/core/plugins';

await dev({
  importMeta: import.meta,
  entryPoint: './main.ts',
  config,
  plugins: [
    PluginTailwind({
      configFile: './tailwind.config.ts',
      include: ['./**/*.css'],
      mode: 'development',
      outFile: 'styles.css',
    }),
  ],
});
