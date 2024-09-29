import { h, Fragment } from "preact";
import type { ComponentType } from "preact";
import {
  DATA_COLLECTION_NAME_ATTRIBUTE,
  DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from "../../shared/constants.ts";
import type {
  DefaultCollectionMetadata,
  MDXComponentProps,
} from "../../types.ts";

export const withMetadata = ({
  metadata,
  Content,
  collectionName,
  collectionEntryName,
}: {
  collectionName: string;
  collectionEntryName: string;
  Content: ComponentType<MDXComponentProps>;
  metadata: DefaultCollectionMetadata;
}) => {
  return () =>
    h(Fragment, {}, [
      h(Content, { metadata }),
      h("script", {
        type: "module",
        dangerouslySetInnerHTML: {
          __html: `
            import Content from "/static/${collectionEntryName}.js";
            window.__collections__ = window.__collections__ || {};
            window.__collections__["${collectionEntryName}"] = Content;
          `,
        },
      }),
      metadata &&
        h("script", {
          type: HYDRATION_SCRIPT_TYPE,
          dangerouslySetInnerHTML: {
            __html: JSON.stringify(metadata),
          },
          [DATA_COLLECTION_NAME_ATTRIBUTE]: collectionName,
          [DATA_COLLECTION_ENTRY_NAME_ATTRIBUTE]: collectionEntryName,
        }),
    ]);
};
