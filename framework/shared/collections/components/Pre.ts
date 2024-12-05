import { useEffect, useState } from 'preact/hooks';
import { type FunctionComponent, h } from 'preact';

type Props = {
  raw: string;
  title?: string;
  language?: string;
};

const CopyButton = ({ raw }: Pick<Props, 'raw'>) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      setCopied(false);
    }, 1_500);
    return () => globalThis.clearTimeout(timer);
  }, [copied]);

  const copy = () => {
    if (copied) {
      return;
    }
    navigator.clipboard
      .writeText(raw)
      .then(() => setCopied(true))
      .catch(() => null);
  };

  let className = 'copy-code-snippet';
  if (copied) {
    className += ' copied';
  }

  return h('button', {
    className,
    onClick: copy,
  }, [
    copied ? 'Copied' : 'Copy',
  ]);
};

export const Pre: FunctionComponent<Props> = ({ children, raw, title }) => {
  return (
    h('pre', { className: 'code-snippet' }, [
      title ? h('div', { className: 'code-snippet-title' }, [title]) : null,
      h(CopyButton, { raw }),
      children,
    ])
  );
};
