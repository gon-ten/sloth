import { getCollection, type PageProps } from "@sloth/core/runtime";
import { Tag } from "@/🧱/Tag.tsx";

export default function Blogs({ url }: PageProps) {
  const { Provider } = getCollection("blogs").all();

  return (
    <div className="container mx-auto">
      <Provider>
        {({ metadata, entryName }) => (
          <section key={entryName} className="w-full mb-2 ">
            <a href={`${url}/${entryName}`}>
              <article>
                <figure>
                  <img
                    srcSet={metadata.image.srcSet}
                    src={metadata.image.src}
                    alt={metadata.image.alt}
                  ></img>
                  {metadata.image.caption && (
                    <figcaption>{metadata.image.caption}</figcaption>
                  )}
                </figure>
                <h1>{metadata.title}</h1>
                <div>
                  {metadata.tags.map((tag, index) => (
                    <Tag key={index}>{tag}</Tag>
                  ))}
                </div>
              </article>
            </a>
          </section>
        )}
      </Provider>
    </div>
  );
}
