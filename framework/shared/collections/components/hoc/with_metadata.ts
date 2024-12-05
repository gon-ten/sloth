import { Fragment, h } from 'preact';
import type { ComponentType } from 'preact';
import {
  DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE,
  DATA_COLLECTION_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from '../../../constants.ts';
import type { MDXComponentProps } from '../../../../types.ts';
import { mdxComponents } from '../index.ts';
import { Script } from '../../../scripts.ts';
import { Link } from '../../../links.ts';
import type { CollectionMapEntry } from '../../../../server/collections_map.ts';

export const withMetadata = ({
  hash,
  metadata,
  Content,
  collectionName,
  collectionEntryName,
  toc,
}: {
  hash: string;
  collectionName: string;
  collectionEntryName: string;
  Content: ComponentType<MDXComponentProps>;
  metadata: CollectionMapEntry['metadata'];
  toc: CollectionMapEntry['toc'];
}) => {
  const metadataStr = JSON.stringify({ metadata, toc });

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
            import Content from "/static/${hash}.js";
            window.__collections__ = window.__collections__ || {};
            window.__collections__["${collectionEntryName}"] = Content;
          `,
        },
      }),
      metadata &&
      h(Script, {
        type: HYDRATION_SCRIPT_TYPE,
        dangerouslySetInnerHTML: {
          __html: metadataStr,
        },
        [DATA_COLLECTION_NAME_ATTRIBUTE]: collectionName,
        [DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE]: collectionEntryName,
      }),
    ]);
  };
};
