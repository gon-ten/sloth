import "preact/debug";
import type { RootProps } from "@gdiezpa/blog/runtime";

export default function Root({ children, links, Metadata }: RootProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Metadata />
        {links}
      </head>
      <body className="bg-white">{children}</body>
    </html>
  );
}
