import * as v from '@valibot/valibot';
import { type CollectionsConfig } from '@sloth/core/content';

const sourceSchema = v.array(
  v.object({
    srcSet: v.string(),
    type: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
  }),
);

export const config = {
  'blogs*': {
    schema: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      heroImage: v.object(
        {
          alt: v.string(),
          caption: v.optional(v.string()),
          sources: v.optional(
            v.object({
              md: sourceSchema,
              sm: sourceSchema,
              lg: sourceSchema,
            }),
          ),
          defaultSource: v.object({
            src: v.string(),
            width: v.optional(v.number()),
            height: v.optional(v.number()),
          }),
          thumbnail: v.optional(sourceSchema),
        },
      ),
      tags: v.array(v.string()),
      publishingDate: v.pipe(
        v.date(),
        v.transform((date) => date.toISOString()),
      ),
    }),
  },
} satisfies CollectionsConfig;
