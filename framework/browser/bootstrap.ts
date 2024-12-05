// import '../shared/option_hooks.ts';
import { type ComponentType, Fragment, h, hydrate, VNode } from 'preact';
import {
  DATA_ROLE_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from '../shared/constants.ts';
import type { LayoutProps } from '../types.ts';

export function bootstrap({
  Page,
  hash,
  layouts,
}: {
  // deno-lint-ignore no-explicit-any
  Page: ComponentType<any>;
  hash: string;
  layouts: Array<{
    Layout: ComponentType<LayoutProps>;
    hash: string;
  }>;
}) {
  const storeEl = document.querySelector(
    `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_ROLE_ATTRIBUTE}="main"]`,
  );

  const store = storeEl?.textContent ? JSON.parse(storeEl.textContent) : {};
  const [common, { [hash]: pageData, ...layoutsData }] = store;

  const page = h(Page, { ...common, pageData });
  const layout = layouts
    // deno-lint-ignore no-explicit-any
    .reduceRight<VNode<any>>(
      (acc, { Layout, hash }) =>
        h(Layout, {
          ...common,
          data: layoutsData[hash],
          Component: () => h(Fragment, null, [acc]),
        }),
      page,
    );

  hydrate(layout, document.body);
}
