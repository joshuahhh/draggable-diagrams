import { useEffect, useRef } from "react";

export function useAnimationLoop(callback: () => void) {
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    const loop = () => {
      callback();
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback]);
}
