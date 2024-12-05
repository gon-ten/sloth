import type { JSX } from 'preact';

export const Link = ({
  className,
  ...otherProps
}: JSX.HTMLAttributes<HTMLAnchorElement>) => {
  return (
    <a
      className={`no-underline focus:underline hover:underline decoration-jade-400 decoration-2 ${className}`}
      {...otherProps}
    />
  );
};
