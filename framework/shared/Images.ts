import { useContext } from 'preact/hooks';
import { type FunctionComponent, h, type JSX } from 'preact';
import { LINKS_CONTEXT } from './links.ts';
import { addStaticPrefix } from './option_hooks.ts';

export type ImageProps = JSX.HTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

function getImageSrcFromProps(props: ImageProps) {
  if (props.src) {
    if (typeof props.src === 'string') {
      return props.src;
    } else {
      return props.src?.peek();
    }
  } else if (props.srcSet || props.srcset) {
    const srcSet = props.srcSet || props.srcset;
    if (typeof srcSet === 'string') {
      return srcSet;
    } else {
      return srcSet?.peek();
    }
  }
}

export const Image: FunctionComponent<ImageProps> = (props) => {
  const links = useContext(LINKS_CONTEXT);
  if (props.priority) {
    const src = getImageSrcFromProps(props);
    if (src) {
      links.unshift({
        rel: 'preload',
        as: 'image',
        imagesrcset: addStaticPrefix(src),
        fetchpriority: 'high',
      });
    }
  }
  return h('img', props);
};
