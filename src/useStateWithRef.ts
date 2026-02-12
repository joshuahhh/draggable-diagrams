import { SetStateAction, useCallback, useRef, useState } from "react";

/**
 * Like useState, but also maintains a ref that's always in sync.
 * The returned setState updates both the ref (synchronously) and
 * the React state (deferred re-render). This eliminates the need
 * to manually keep a ref in sync alongside useState.
 */
export function useStateWithRef<T>(
  initialState: T | (() => T),
): [T, (action: SetStateAction<T>) => void, React.RefObject<T>] {
  const [state, setState] = useState(initialState);
  const ref = useRef(state);
  ref.current = state;

  const setStateAndRef = useCallback((action: SetStateAction<T>) => {
    const newValue =
      typeof action === "function"
        ? (action as (prev: T) => T)(ref.current)
        : action;
    ref.current = newValue;
    setState(newValue);
  }, []);

  return [state, setStateAndRef, ref];
}
