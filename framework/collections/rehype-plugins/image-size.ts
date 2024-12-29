import { visit } from 'unist-util-visit';
import { exists } from '@std/fs/exists';
import { imageSize } from 'image-size';

type ImageSize = {
  width?: number;
  height?: number;
};

const imageSizeCache: Map<string, ImageSize | undefined> = new Map();

async function getImageSize(
  filePath: string,
): Promise<ImageSize> {
  if (imageSizeCache.has(filePath)) {
    return imageSizeCache.get(filePath)!;
  }

  const fileExists = await exists(filePath);

  if (!fileExists) {
    return {};
  }

  try {
    const buff = await Deno.readFile(filePath);
    const { width, height } = imageSize(buff) ?? {};
    const result = { width, height };
    imageSizeCache.set(filePath, result);
    return result;
  } catch (err) {
    console.log(
      `Could not get image ${filePath} size`,
      err,
    );
    return {};
  }
}

export default function ImageSizeRehypePlugin({
  pathResolver,
}: {
  pathResolver: (imageSrcAttribute: string) => string;
}) {
  return () => async (tree: unknown) => {
    const promises: Promise<void>[] = [];
    // deno-lint-ignore no-explicit-any
    visit(tree, ['element'], (node: any) => {
      let src: string | undefined;
      if (node.type === 'element' && node?.tagName === 'img') {
        src = node.properties.src;
      }

      if (!src) {
        return;
      }

      promises.push(
        getImageSize(
          pathResolver(src),
        ).then(({ width, height }) => {
          node.properties['width'] = width;
          node.properties['height'] = height;
        }),
      );
    });

    await Promise.allSettled(promises);
  };
}
