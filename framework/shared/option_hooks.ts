import { type JSX, type VNode, options } from "preact";

const oldVnode = options.vnode;

function addStaticPrefix(srcOrSrcSet: string | string[]): string {
  if (Array.isArray(srcOrSrcSet)) {
    return srcOrSrcSet.map((src) => addStaticPrefix(src)).join(", ");
  }
  if (!/\/{1}/.test(srcOrSrcSet)) {
    return srcOrSrcSet;
  }
  return `/static${srcOrSrcSet}`;
}

options.vnode = (vnode) => {
  if (vnode.type === "img" || vnode.type === "source") {
    const imgOrSourceVNode = vnode as VNode<
      JSX.HTMLAttributes<HTMLImageElement | HTMLSourceElement>
    >;
    if (typeof imgOrSourceVNode.props.src === "string") {
      imgOrSourceVNode.props.src = addStaticPrefix(imgOrSourceVNode.props.src);
    }

    for (const prop of ["srcset", "srcSet"] as const) {
      if (typeof imgOrSourceVNode.props[prop] === "string") {
        imgOrSourceVNode.props[prop] = addStaticPrefix(
          imgOrSourceVNode.props[prop].split(",").map((part) => part.trim())
        );
      }
    }
  }

  oldVnode?.(vnode);
};
