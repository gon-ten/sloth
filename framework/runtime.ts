import { Image as ImageServer } from './shared/Images.ts';
import { Image as ImageClient } from './browser/Images.ts';
import { Script as ScriptServer } from './shared/scripts.ts';
import { Link as LinkServer } from './shared/links.ts';
export { Head } from './shared/head.ts';

export const IS_BROWSER = typeof document !== 'undefined';

export let Image = ImageServer;

export let Script = ScriptServer;

export let Link = LinkServer;

// This condition will be replaced when bundling (see define)
if (globalThis.BUILD_TIME) {
  Image = ImageClient;
  Script = () => null;
  Link = () => null;
}
