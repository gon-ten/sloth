import { FunctionComponent } from 'preact';

export type TagProps = {
  children: string;
};

export const Tag: FunctionComponent<TagProps> = ({ children }) => {
  return <span className='inline-flex text-sm px-2 h-6'>{children}</span>;
};
