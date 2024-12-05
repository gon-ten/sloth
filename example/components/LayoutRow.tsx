import clsx from 'clsx';
import type { ComponentChildren, FunctionComponent } from 'preact';

type Props = {
  className?: string;
  children?: ComponentChildren;
};

export const LayoutRow: FunctionComponent<Props> = (
  { children, className }: Props,
) => {
  return (
    <div class={clsx('sm:px-8', className)}>
      <div class='mx-auto w-full max-w-7xl lg:px-8'>
        <div class='relative px-4 sm:px-8 lg:px-12'>
          <div class='mx-auto max-w-2xl lg:max-w-5xl'>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
