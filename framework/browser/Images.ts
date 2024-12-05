import { type FunctionComponent, h } from 'preact';
import type { ImageProps } from '../shared/Images.ts';

export const Image: FunctionComponent<ImageProps> = (
  { priority: _, ...props },
) => h('img', props);
