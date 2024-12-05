import { Fragment, h, VNode } from 'preact';
import * as v from '@valibot/valibot';
import { ValidMetadata } from '../types.ts';

export const metadataSchema = v.object({
  title: v.optional(v.string()),
  description: v.optional(v.string()),
});

export function metadataToVnode(
  metadata: v.InferOutput<typeof metadataSchema>,
  // deno-lint-ignore ban-types
): VNode<{}> {
  // deno-lint-ignore no-explicit-any
  const children: VNode<any>[] = [];

  const { title, description } = metadata;

  if (title) {
    children.push(
      h('title', { key: 'title' }, [title]),
    );
  }

  if (description) {
    children.push(
      h('meta', {
        key: 'description',
        name: 'description',
        content: description,
      }),
    );
  }

  return h(Fragment, null, children);
}

export async function verifyMetadata(
  metadata?: ValidMetadata,
): Promise<void> {
  if (!metadata || typeof metadata === 'function') {
    return;
  }
  // Parse metadata object if not dymanic
  await v.parseAsync(metadataSchema, metadata);
}
