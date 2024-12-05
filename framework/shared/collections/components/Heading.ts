import { h } from 'preact';
import type { FunctionComponent } from 'preact';

type Props = {
  id: string;
  tagName: 'h1' | 'h2' | 'h3';
};

export const Heading: FunctionComponent<Props> = ({
  children,
  id,
  tagName,
}) => {
  const copyHref = () => {
    const url = new URL(location.href);
    url.hash = id;
    navigator.clipboard.writeText(url.href).catch(() => null);
  };

  const HeadingTag = tagName;

  return (
    h(HeadingTag, { className: 'collection-heading', id }, [
      children,
      id
        ? h('button', {
          onClick: copyHref,
          dangerouslySetInnerHTML: {
            __html:
              `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' /><path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' /></svg>`,
          },
        })
        : null,
    ])
  );
};
