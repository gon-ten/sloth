import { Fragment, h } from 'preact';
import { useContext } from 'preact/hooks';
import { createContext, type FunctionComponent, type JSX } from 'preact';

type Props = {
  nonce?: string;
};

export type ScriptProps = JSX.HTMLAttributes<HTMLScriptElement> & {
  [name: `data-${string}`]: string;
};

export const Script: FunctionComponent<ScriptProps> = (props) => {
  const ctx = useContext(SCRIPTS_CONTEXT);
  ctx.unshift(props);
  return null;
};

export const Scripts: FunctionComponent<Props> = ({ nonce }) => {
  const ctx = useContext(SCRIPTS_CONTEXT);
  return h(
    Fragment,
    null,
    ctx.map((props) => h('script', { ...props, nonce })),
  );
};

export const SCRIPTS_CONTEXT = createContext<ScriptProps[]>([]);
