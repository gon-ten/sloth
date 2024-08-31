import { type FunctionComponent } from "preact";
import { useLocation } from "preact-iso";

const Home: FunctionComponent = () => {
  const location = useLocation();
  return (
    <div>
      Home
      <a href="/about">Go About</a>
      <button onClick={() => location.route("/about")}>Go About</button>
    </div>
  );
};

export default Home;
