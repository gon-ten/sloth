import type { FunctionComponent } from "preact";
import { Link } from "@/🧱/Link.tsx";

const Home: FunctionComponent = () => {
  return (
    <div>
      Home
      <nav className="flex flex-row gap-2">
        <Link href="/">Index</Link>
        <Link href="/about">Go About</Link>
      </nav>
    </div>
  );
};

export default Home;
