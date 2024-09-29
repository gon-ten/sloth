import { z } from "zod";

export const config = {
  "blogs*": {
    schema: z.object({
      title: z.string(),
      image: z.object({
        src: z.string(),
        srcSet: z.string().optional(),
        alt: z.string(),
        caption: z.string().optional(),
      }),
      tags: z.array(z.string()),
    }),
  },
} as const;
