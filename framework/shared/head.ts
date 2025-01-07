import type { FunctionComponent } from 'preact';
import { VNode } from 'preact';
import { createContext } from 'preact';
import { isValidElement, toChildArray } from 'preact';
import { useContext, useId, useRef } from 'preact/hooks';

const allowedTags = ['link', 'meta', 'title'];

const HeadBrowser: FunctionComponent = ({ children }) => {
  const originalTitle = useRef(document.title);
  const currentElement = useRef<HTMLElement[]>([]);

  const id = useId();

  const removedSsrChildren = useRef(false);
  if (!removedSsrChildren.current) {
    document.head.querySelectorAll(`[data-head-id="${id}"]`).forEach(
      (element) => {
        element.parentElement?.removeChild(element);
      },
    );
    removedSsrChildren.current = true;
  }

  while (currentElement.current.length) {
    document.head.removeChild(currentElement.current.pop()!);
  }

  currentElement.current.length = 0;

  let titleFound = false;

  toChildArray(children).forEach((child) => {
    if (isValidElement(child) && typeof child.type === 'string') {
      if (!allowedTags.includes(child.type)) {
        console.warn(
          `The tag "${child.type}" is not supported in the <Head> component yet.`,
        );
        return;
      }
      if (child.type === 'title') {
        document.title = String(child.props.children);
        titleFound = true;
        return;
      }
      const element = document.createElement(child.type);
      Object.entries(child.props).forEach(([key, value]) => {
        if (key in element) {
          element.setAttribute(key, String(value));
        }
      });
      document.head.appendChild(element);
      currentElement.current.push(element);
    }
  });

  if (!titleFound) {
    document.title = originalTitle.current;
  }

  return null;
};

const HeadServer: FunctionComponent = ({ children }) => {
  const id = useId();
  const ctx = useContext(HEAD_CONTEXT);
  toChildArray(children).forEach((child) => {
    if (isValidElement(child)) {
      // @ts-ignore this is a hack to add the id to the child
      child.props['data-head-id'] = id;
      ctx.push(child);
    }
  });
  return null;
};

export const HEAD_CONTEXT = createContext<VNode[]>([]);

export const Head = globalThis.BUILD_TIME ? HeadBrowser : HeadServer;
