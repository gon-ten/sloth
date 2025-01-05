import { Fragment, h } from 'preact';
import type { ComponentType } from 'preact';
import type {
  CollectionMapEntry,
  MDXComponentProps,
} from '../../../../types.ts';
import { mdxComponents } from '../index.ts';
import { Script } from '../../../scripts.ts';
import { Link } from '../../../links.ts';

export const withClientCode = ({
  hash,
  metadata,
  Content,
  collectionName,
  collectionEntryName,
}: {
  hash: string;
  collectionName: string;
  collectionEntryName: string;
  Content: ComponentType<MDXComponentProps>;
  metadata: CollectionMapEntry['metadata'];
}) => {
  return () => {
    return h(Fragment, {}, [
      h(Content, { metadata, components: mdxComponents }),
      h(Link, {
        rel: 'preload',
        as: 'script',
        href: `/static/${hash}.js`,
        crossOrigin: 'anonymous',
      }),
      h(Script, {
        type: 'module',
        dangerouslySetInnerHTML: {
          __html: `
            import * as C from "/static/${hash}.js";
            window.__collections__ = window.__collections__ || {};
            window.__collections__["${collectionName}"] = window.__collections__["${collectionName}"] || { entries: {} };
            window.__collections__["${collectionName}"].entries["${collectionEntryName}"] = C;
          `,
        },
      }),
    ]);
  };
};
