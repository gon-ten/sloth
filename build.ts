import { walk } from "@std/fs";
import { compile } from "@mdx-js/mdx";
import rehypeHighlight from "rehype-highlight";

const textEncoder = new TextEncoder();

for await (const post of walk(new URL("./posts", import.meta.url), {
  includeDirs: false,
  match: [/.mdx$/],
})) {
  const buffer = await Deno.readFile(post.path);
  const result = await compile(buffer, {
    outputFormat: "program",
    jsxImportSource: "preact",
    rehypePlugins: [rehypeHighlight],
  });
  const dstName = post.name.replace(/.mdx$/, ".jsx");
  const dstPath = new URL(`.compiled/${dstName}`, import.meta.url);
  await Deno.writeFile(
    dstPath,
    result.value instanceof Uint8Array
      ? result.value
      : textEncoder.encode(result.value)
  );
}
