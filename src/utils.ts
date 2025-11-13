export function assertNever(_never: never, message?: string): never {
  throw new Error(
    message || `Reached unreachable code: unexpected value ${_never}`,
  );
}

export function assert(condition: boolean, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg ?? "Assertion failed");
  }
}

// it's too easy to call clamp with arguments in the wrong order, so
// this one is symmetric
export function clamp(a: number, b: number, c: number): number {
  return a + b + c - Math.max(a, b, c) - Math.min(a, b, c);
}

export function insert<T>(arr: T[], idx: number, val: T): T[] {
  const newArr = arr.slice();
  newArr.splice(idx, 0, val);
  return newArr;
}

export function remove<T>(arr: T[], idx: number): T[] {
  const newArr = arr.slice();
  newArr.splice(idx, 1);
  return newArr;
}

export function set<T>(arr: T[], idx: number, val: T): T[] {
  const newArr = arr.slice();
  newArr[idx] = val;
  return newArr;
}

export function filterMap<A, B>(
  xs: readonly A[],
  f: (a: A) => B | undefined,
): B[] {
  const out: B[] = [];
  for (const a of xs) {
    const v = f(a);
    if (v !== undefined) out.push(v);
  }
  return out;
}
