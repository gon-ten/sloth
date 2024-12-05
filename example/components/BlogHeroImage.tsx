import type { FunctionComponent } from 'preact';
import { type CollectionsMap } from '@sloth/core/content';

type Props = {
  heroImage: CollectionsMap['blogs']['metadata']['heroImage'];
  noCaption?: boolean;
};

export const BlogHeroImage: FunctionComponent<Props> = (
  { heroImage, noCaption },
) => {
  const { sm = [], md = [], lg = [] } = heroImage.sources ?? {};

  return (
    <picture>
      {sm?.map((props) => (
        <source
          {...props}
          loading='lazy'
          decoding='async'
          media='(max-width: 768px)'
        />
      ))}
      {md?.map((props) => (
        <source
          {...props}
          loading='lazy'
          decoding='async'
          media='(min-width: 768px) and (max-width: 1024px)'
        />
      ))}
      {lg?.map((props) => (
        <source
          {...props}
          loading='lazy'
          decoding='async'
          media='(min-width: 1024px)'
        />
      ))}
      <img
        loading='lazy'
        decoding='async'
        height={heroImage.defaultSource.height}
        width={heroImage.defaultSource.width}
        src={heroImage.defaultSource.src}
        alt={heroImage.alt}
      />
      {!noCaption && heroImage.caption
        ? <figcaption>{heroImage.caption}</figcaption>
        : null}
    </picture>
  );
};
