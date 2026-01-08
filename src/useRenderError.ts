import { useState } from "react";

export function useThrowRenderError() {
  const [error, setError] = useState<unknown>(null);

  if (error) {
    throw error;
  }

  return (err: unknown) => {
    setError(err);
    throw err;
  };
}

export function useCatchToRenderError() {
  const throwRenderError = useThrowRenderError();

  return function catchToRenderError<TArgs extends any[], TReturn>(
    fn: (...args: TArgs) => TReturn
  ) {
    return (...args: TArgs) => {
      try {
        return fn(...args);
      } catch (error) {
        return throwRenderError(error);
      }
    };
  };
}

export type CatchToRenderError = ReturnType<typeof useCatchToRenderError>;
