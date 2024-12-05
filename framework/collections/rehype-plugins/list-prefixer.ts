import { visit } from 'unist-util-visit';

export default function ListPrefixerRehypePlugin() {
  return (tree: unknown) => {
    // deno-lint-ignore no-explicit-any
    visit(tree, 'element', (node: any) => {
      if (
        node?.type === 'element' &&
        ['ul', 'ol'].includes(node?.tagName)
      ) {
        if (Array.isArray(node.children)) {
          let i = 0;
          // deno-lint-ignore no-explicit-any
          (node.children as any[]).forEach((child) => {
            if (child.type === 'element' && child.tagName === 'li') {
              child.properties['data-prefix'] = node.tagName === 'ol'
                ? `${++i}`
                : '-1';
            }
          });
        }
      }
    });
  };
}
