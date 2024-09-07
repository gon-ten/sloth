export {};

declare global {
  interface ImportMeta {
    env: {
      IS_BROWSER: boolean;
    };
  }
}
