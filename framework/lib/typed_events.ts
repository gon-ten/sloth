type Disposable = () => void;

// deno-lint-ignore no-explicit-any
type EventMap = { [key: string]: (...args: any[]) => void };

type ListenersMap<E extends EventMap> = Map<
  keyof E,
  { on: Array<E[keyof E]>; once: Array<E[keyof E]> }
>;

export class TypedEvents<E extends EventMap> {
  #listeners: ListenersMap<E> = new Map();

  addListener = this.on.bind(this);
  removeListener = this.off.bind(this);

  constructor(readonly maxListeners = 10) {}

  removeAllListeners<N extends keyof E>(name?: N): this {
    if (name) {
      this.#listeners.delete(name);
    } else {
      this.#listeners.clear();
    }
    return this;
  }

  off<N extends keyof E>(name: N, handler: E[N]): this {
    const entry = this.#listeners.get(name);
    if (entry) {
      entry.on = entry.on.filter((h) => h !== handler);
      entry.once = entry.once.filter((h) => h !== handler);
    }
    return this;
  }

  once<N extends keyof E>(name: N, handler: E[N]): Disposable {
    const entry = this.#listeners.get(name) ?? { on: [], once: [] };

    if (entry) {
      entry.once = entry.once.concat(handler);
    }

    this.#listeners.set(name, entry);

    return () => {
      this.off(name, handler);
    };
  }

  on<N extends keyof E>(name: N, handler: E[N]): Disposable {
    const entry = this.#listeners.get(name) ?? { on: [], once: [] };

    if (entry) {
      if (entry.on.length === this.maxListeners) {
        throw Error(
          `Max listeners reached for <${String(name)}> event`,
        );
      }
      entry.on = entry.on.concat(handler);
    }

    this.#listeners.set(name, entry);

    return () => {
      this.off(name, handler);
    };
  }

  emit<N extends keyof E>(name: N, ...args: Parameters<E[N]>): boolean {
    const entry = this.#listeners.get(name);

    if (!entry) {
      return false;
    }

    if (entry.once.length > 0) {
      const once = entry.once.concat();
      entry.once.length = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const next = once.shift();
        if (!next) {
          break;
        }
        next(...args);
      }
    }

    if (entry.on.length > 0) {
      for (let i = 0, L = entry.on.length; i < L; i++) {
        entry.on[i]!(...args);
      }
    }

    return true;
  }
}
