import { h } from 'preact';
import type { FunctionComponent, JSX } from 'preact';

type Props = JSX.HTMLAttributes<HTMLImageElement>;

export const Img: FunctionComponent<Props> = (props) => {
  return h('img', {
    loading: 'lazy',
    decoding: 'async',
    className: 'collection-image',
    ...props,
  });
};
