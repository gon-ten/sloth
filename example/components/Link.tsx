import type { JSX } from "preact";

export const Link = ({
  className,
  ...otherProps
}: JSX.HTMLAttributes<HTMLAnchorElement>) => {
  return <a className={`text-xs ${className}`} {...otherProps} />;
};
