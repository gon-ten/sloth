import {
  ErrorBoundary,
  lazy,
  LocationProvider,
  Route,
  Router,
  useLocation,
} from "preact-iso";

const GoHome = () => {
  const location = useLocation();
  return <div onClick={() => location.route("/home")}>Go Home</div>;
};

const Home = lazy(() => import("./routes/Home.tsx"));
const About = lazy(() => import("./routes/About.tsx"));

export default function Root() {
  return (
    <LocationProvider>
      <ErrorBoundary>
        <Router>
          <Route path="/about" component={About} />
          <Route path="/home" component={Home} />
          <Route default component={GoHome}></Route>
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
