import { visit } from 'unist-util-visit';

export default function CodeBlockMetadataRehypePlugin() {
  return (tree: unknown) => {
    // deno-lint-ignore no-explicit-any
    visit(tree, (node: any) => {
      if (node?.type === 'element' && node?.tagName === 'pre') {
        const codeElement = node.children[0];
        if (codeElement.tagName !== 'code') {
          return;
        }

        node.properties['raw'] = codeElement.children?.[0].value;

        const languageMatch = /language-(\w+)/.exec(
          codeElement.properties?.className ?? '',
        );

        if (languageMatch) {
          node.properties['language'] = languageMatch[0];
        }

        const metadata = codeElement?.data?.meta;
        if (typeof metadata === 'string') {
          const titleMatch = metadata.match(/title=\"(?<title>.*)\"/i);
          if (titleMatch) {
            node.properties['title'] = titleMatch.groups?.title;
          }
          const descriptionMatch = metadata.match(
            /description=\"(?<description>.*)\"/i,
          );
          if (descriptionMatch) {
            node.properties['description'] = descriptionMatch.groups
              ?.description;
          }
        }
      }
    });
  };
}
