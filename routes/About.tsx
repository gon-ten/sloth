import { type FunctionComponent } from "preact";
import { useLocation } from "preact-iso";

const About: FunctionComponent = () => {
  const location = useLocation();
  return (
    <div>
      About
      <button onClick={() => location.route("/home")}>Go home</button>
    </div>
  );
};

export default About;
