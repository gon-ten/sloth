import type { LayoutProps } from "@gdiezpa/blog/runtime";
import { Link } from "@/🧱/Link.tsx";

export default function BaseLayout({ children }: LayoutProps) {
  return (
    <>
      <div className="w-screen h-screen overflow-auto">
        <header className="sticky top-0 bg-white border-b border-neutral-200">
          <div className="h-10 bg-red-500 container mx-auto">
            <nav className="h-full flex flex-row items-center gap-2">
              <Link href="/about">About</Link>
              <Link href="/home">Home</Link>
              <Link href="/blog">Blog</Link>
            </nav>
          </div>
        </header>
        <main className="text-sm bg-green-500">{children}</main>
      </div>
    </>
  );
}
