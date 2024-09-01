import { type FunctionComponent } from "preact";
import { useLocation } from "preact-iso";
import { RouteHandlers } from "@gdiezpa/blog";

export const handlers: RouteHandlers = {
  GET() {
    return Response.json({ method: "GET" });
  },
  POST() {
    return Response.json({ method: "POST" });
  },
};

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
