import { Link } from "@/🧱/Link.tsx";

const Home = () => {
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
