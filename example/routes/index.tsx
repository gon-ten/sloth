import { Link } from "@/🧱/Link.tsx";

export default function Index() {
  return (
    <div className="container">
      <header>
        <nav className="h-14 flex flex-row justify-center items-center">
          <Link href="./about">About</Link>
          <Link href="./home">Home</Link>
        </nav>
      </header>
      <main className="flex flex-col justify-center items-center">
        <div className="text-9xl text-center">🦥</div>
        <div className="mt-6">
          You can start by modifiying <code>./routes/index.tsx</code>
        </div>
        <img src="/static/images/sloth_01.jpg" />
      </main>
    </div>
  );
}
