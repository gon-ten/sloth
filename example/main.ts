import { start } from '@sloth/core/server';
import { manifest } from './manifest.gen.ts';

await start({ manifest });

/*
import { exists } from '@std/fs';
import { basename, extname, fromFileUrl } from '@std/path';
*/

/*
await load({
  envPath: fromFileUrl(new URL('.env', import.meta.url)),
  export: true,
});
*/

/*
const Li: FunctionComponent<{ children: string; 'data-prefix': string }> = (
  props,
) => h(Fragment, {}, [`${props['data-prefix']} ${props.children}`]);

const Img: FunctionComponent<JSX.HTMLAttributes<HTMLImageElement>> = (
  props,
) => h(Fragment, {}, [`Image - ${props.title ?? ''} ${props.alt ?? ''}`]);

const Hr: FunctionComponent = () => h(Fragment, {}, [`\n`]);

const components = {
  h1: Fragment,
  h2: Fragment,
  h3: Fragment,
  h4: Fragment,
  h5: Fragment,
  code: Fragment,
  pre: Fragment,
  div: Fragment,
  p: Fragment,
  span: Fragment,
  strong: Fragment,
  ul: Fragment,
  ol: Fragment,
  li: Li,
  img: Img,
  em: Fragment,
  br: Fragment,
  blockquote: Fragment,
  a: Fragment,
  hr: Hr,
};
*/

//plugins: [
//{
//name: 'openai-tts',
//setup(_builder) {
///*
//return;

//builder.onCompileCollectionEnd(async (collections) => {
//if (collections.length === 0) {
//return;
//}

//const { MDXComponent, metadata, path } = collections[0];

//const dstPath = fromFileUrl(
//new URL(
//'./audio/' + path.slice(0, -extname(path).length) + '.mp3',
//import.meta.url,
//),
//);

//const dstFileExists = await exists(dstPath);
//const dstDir = dstPath.slice(0, -basename(dstPath).length);

//await Deno.mkdir(dstDir, { recursive: true }).catch(() => null);

//if (dstFileExists) {
//return;
//}

//builder.wg.add(1);

//try {
//const mp3 = await openai.audio.speech.create({
//model: 'tts-1-hd',
//input: renderToString(
//h(MDXComponent, { components, metadata }),
//),
//voice: 'alloy',
//});
//const buffer = await mp3.arrayBuffer();
//await Deno.writeFile(dstPath, new Uint8Array(buffer));
//} finally {
//builder.wg.done();
//}
//});
//*/
//},
//},
//],
