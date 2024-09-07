import { type ComponentType, h } from "preact";
import { hydrate } from "preact";
import { HYDRATION_SCRIPT_MEDIA_TYPE } from "./utils.ts";

export function setupClient(Page: ComponentType, hash: string) {
  const storeEl = document.querySelector(
    `script[type="${HYDRATION_SCRIPT_MEDIA_TYPE}"]`
  );
  const store = storeEl?.textContent ? JSON.parse(storeEl.textContent) : {};
  const props = store[hash];
  if (!props) {
    console.warn(
      `Page could not be hydrated correctly. Missing dynamic data in the client side`
    );
  }
  hydrate(h(Page, props), document.querySelector("#root")!);
}
