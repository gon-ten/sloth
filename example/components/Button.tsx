import type { FunctionComponent, JSX } from 'preact';

type Props = JSX.HTMLAttributes<HTMLButtonElement>;

export const Button: FunctionComponent<Props> = ({
  className,
  class: classProp,
  ...otherProps
}) => {
  let classNameValue =
    'px-3 h-9 min-w-40 text–base rounded-lg inline-flex items-center justify-center from-jade-500 to-jade-600 bg-gradient-to-b text-jade-950 shadow-bezel hover:from-jade-600 hover:to-jade-700 active:from-jade-700 active:to-jade-800 disabled:from-jade-100 disabled:to-jade-100 disabled:shadow-none disabled:text-jade-400';
  if (className) {
    classNameValue += ` ${className}`;
  }
  if (classProp) {
    classNameValue += ` ${classProp}`;
  }
  return <button className={classNameValue} {...otherProps} />;
};
