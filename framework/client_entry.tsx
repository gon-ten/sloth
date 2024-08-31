import { hydrate } from "preact-iso";

const { default: Root } = await import(import.meta.env.ROOT_ENTRY);
hydrate(<Root />, document.querySelector("#root")!);
