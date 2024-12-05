import { useContext } from 'preact/hooks';
import {
  type ComponentType,
  createContext,
  Fragment,
  type FunctionComponent,
  h,
  type JSX,
} from 'preact';

export type LinksProps = JSX.HTMLAttributes<HTMLLinkElement> & {
  imagesrcset?: string;
  fetchpriority?: string;
  imagesizes?: string;
};

export const Link: FunctionComponent<LinksProps> = (props) => {
  const links = useContext(LINKS_CONTEXT);
  links.push(props);
  return null;
};

export const Links: ComponentType = () => {
  const links = useContext(LINKS_CONTEXT);
  return h(Fragment, null, links.map((props) => h('link', props)));
};

export const LINKS_CONTEXT = createContext<LinksProps[]>([]);
