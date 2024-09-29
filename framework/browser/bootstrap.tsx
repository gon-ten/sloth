import "../shared/option_hooks.ts";
import type { ComponentType } from "preact";
import { hydrate } from "preact-iso";
import {
  DATA_ROLE_ATTRIBUTE,
  HYDRATION_SCRIPT_TYPE,
} from "../shared/constants.ts";

export function bootstrap({
  Page,
  hash,
  layouts,
}: {
  Page: ComponentType;
  hash: string;
  layouts: Array<{
    Layout: ComponentType;
    hash: string;
  }>;
}) {
  const storeEl = document.querySelector(
    `script[type="${HYDRATION_SCRIPT_TYPE}"][${DATA_ROLE_ATTRIBUTE}="main"]`
  );

  const store = storeEl?.textContent ? JSON.parse(storeEl.textContent) : {};
  const props = store[hash];

  if (!props) {
    console.warn(
      `Page could not be hydrated correctly. Missing dynamic data in the client side`
    );
  }

  try {
    const page = <Page {...props} />;
    const layout = layouts
      .reverse()
      .reduce(
        (acc, { Layout, hash }) => <Layout {...store[hash]}>{acc}</Layout>,
        page
      );
    hydrate(layout, document.body);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
