import type { LayoutProps } from "@sloth/core/runtime";

export default function LangLayout({ children }: LayoutProps) {
  return (
    <div className="bg-red-500">
      Lang layout
      {children}
    </div>
  );
}
