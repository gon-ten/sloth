import dev from '@sloth/core/dev';
import { config } from './config.ts';

await dev({
  baseUrl: import.meta.url,
  entryPoint: './main.ts',
  config,
  plugins: [],
});
