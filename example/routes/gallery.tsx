import type { ComposeRouteTypes } from "@gdiezpa/blog/runtime";

type RouteTypes = ComposeRouteTypes<
  Array<{
    id: number;
    imageSrc: string;
  }>
>;

export const loader: RouteTypes["Loader"] = () => {
  return Promise.resolve([
    {
      id: 1,
      imageSrc: "/static/images/sloth_01.jpg",
    },
    {
      id: 2,
      imageSrc: "/static/images/sloth_02.jpg",
    },
    {
      id: 3,
      imageSrc: "/static/images/sloth_03.jpg",
    },
    {
      id: 4,
      imageSrc: "/static/images/sloth_04.jpg",
    },
  ]);
};

export default function Gallery({ data }: RouteTypes["PagaProps"]) {
  return (
    <div className="w-screen h-screen flex flex-col bg-slate-900">
      <header>
        <h1 className="text-center font-bold text-3xl my-10 text-slate-50">
          Sloth gallery 🦥
        </h1>
      </header>
      <main className="w-full h-full grid grid-cols-2 grid-rows-2 *:place-self-center">
        {data.map(({ id, imageSrc }) => (
          <img
            key={id}
            src={imageSrc}
            className="rounded-2xl hover:scale-125"
          />
        ))}
      </main>
    </div>
  );
}
