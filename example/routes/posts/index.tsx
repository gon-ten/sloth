import { getCollection } from "@gdiezpa/blog/runtime";

export default function Posts() {
  const { Provider } = getCollection("blogs").all();

  return (
    <div className="container mx-auto">
      <Provider>
        {({ metadata, entryName }) => (
          <section>
            <h1>{entryName}</h1>
            <h2>{metadata.title}</h2>
          </section>
        )}
      </Provider>
    </div>
  );
}
