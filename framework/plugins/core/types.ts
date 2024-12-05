import { Builder } from './builder.ts';
import type { ComponentType } from 'preact';
import type { MDXComponentProps } from '../../types.ts';

export type CollectionsEventMap = {
  end: (
    data: Array<{
      MDXComponent: ComponentType<MDXComponentProps>;
      metadata: MDXComponentProps['metadata'];
      path: string;
    }>,
  ) => void;
};

export type Lambda = () => void;

export type Plugin = {
  name: Lowercase<string>;
  setup: (builder: Builder) => void | Promise<void>;
};
