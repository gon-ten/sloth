import { visit } from 'unist-util-visit';
import { slugifyWithCounter } from '@sindresorhus/slugify';

export type Toc = Array<{
  content: string;
  deep: number;
  hash: string;
}>;

export default function TocRehypePlugin(
  { onDone }: { onDone(toc: Toc): void },
) {
  return () => (tree: unknown) => {
    const slugify = slugifyWithCounter();
    const toc: Toc = [];
    // deno-lint-ignore no-explicit-any
    visit(tree, 'element', (node: any) => {
      if (
        node?.type === 'element' &&
        ['h1', 'h2', 'h3'].includes(node?.tagName)
      ) {
        const textNode = node.children[0];
        if (!textNode || textNode.type !== 'text') {
          return;
        }
        const slug = slugify(textNode.value);
        node.properties['id'] = slug;
        node.properties['tagName'] = node.tagName;

        toc.push(
          {
            hash: slug,
            content: textNode.value,
            deep: node.tagName === 'h1' ? 1 : node.tagName === 'h2' ? 2 : 3,
          },
        );
      }
    });

    onDone(toc);
  };
}
