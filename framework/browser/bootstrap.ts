// import '../shared/option_hooks.ts';
import { type ComponentType, Fragment, h, hydrate, VNode } from 'preact';
import type { HydrationData, LayoutProps, PageProps } from '../types.ts';

export function bootstrap({
  Page,
  hash,
  layouts,
  hydrationData,
}: {
  Page: ComponentType<PageProps>;
  hash: string;
  layouts: Array<{
    Layout: ComponentType<LayoutProps>;
    hash: string;
  }>;
  hydrationData: HydrationData;
}) {
  const [common, { [hash]: data, ...layoutsData }] = hydrationData;

  const page = h(Page, { ...common, data } as PageProps);
  const layout = layouts
    // deno-lint-ignore no-explicit-any
    .reduceRight<VNode<any>>(
      (acc, { Layout, hash }) =>
        h(Layout, {
          ...common,
          data: layoutsData[hash],
          Component: () => h(Fragment, null, [acc]),
        } as unknown as LayoutProps),
      page,
    );

  hydrate(layout, document.body);
}
