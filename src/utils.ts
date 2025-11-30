export function assertNever(_never: never, message?: string): never {
  throw new Error(
    message || `Reached unreachable code: unexpected value ${_never}`,
  );
}

export function assert(
  condition: boolean,
  msg?: string | (() => void),
): asserts condition {
  if (!condition) {
    if (typeof msg === "function") {
      console.group("Assertion failed; debug info:");
      msg();
      console.groupEnd();
      throw new Error("Assertion failed");
    } else {
      throw new Error(msg ?? "Assertion failed");
    }
  }
}

export function assertWarning(
  condition: boolean,
  msg?: string | (() => void),
): void {
  if (!condition) {
    if (typeof msg === "function") {
      console.group("Warning assertion failed; debug info:");
      msg();
      console.groupEnd();
    } else {
      console.warn("Warning assertion failed:", msg || "");
    }
  }
}

// it's too easy to call clamp with arguments in the wrong order, so
// this one is symmetric
export function clamp(a: number, b: number, c: number): number {
  return a + b + c - Math.max(a, b, c) - Math.min(a, b, c);
}

export function insertImm<T>(arr: T[], idx: number, val: T): T[] {
  const newArr = arr.slice();
  newArr.splice(idx, 0, val);
  return newArr;
}

export function removeImm<T>(arr: T[], idx: number): T[] {
  const newArr = arr.slice();
  newArr.splice(idx, 1);
  return newArr;
}

export function setImm<T>(arr: T[], idx: number, val: T): T[] {
  const newArr = arr.slice();
  newArr[idx] = val;
  return newArr;
}

export function defined<T>(x: T | undefined | null): x is T {
  return x !== undefined && x !== null;
}

export function pipe<T1, T2>(arg: T1, fn1: (arg: T1) => T2): T2;
export function pipe<T1, T2, T3>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
): T3;
export function pipe<T1, T2, T3, T4>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
  fn3: (arg: T3) => T4,
): T4;
export function pipe<T1, T2, T3, T4, T5>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
  fn3: (arg: T3) => T4,
  fn4: (arg: T4) => T5,
): T5;
export function pipe<T1, T2, T3, T4, T5, T6>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
  fn3: (arg: T3) => T4,
  fn4: (arg: T4) => T5,
  fn5: (arg: T5) => T6,
): T6;
export function pipe<T1, T2, T3, T4, T5, T6, T7>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
  fn3: (arg: T3) => T4,
  fn4: (arg: T4) => T5,
  fn5: (arg: T5) => T6,
  fn6: (arg: T6) => T7,
): T7;
export function pipe<T1, T2, T3, T4, T5, T6, T7, T8>(
  arg: T1,
  fn1: (arg: T1) => T2,
  fn2: (arg: T2) => T3,
  fn3: (arg: T3) => T4,
  fn4: (arg: T4) => T5,
  fn5: (arg: T5) => T6,
  fn6: (arg: T6) => T7,
  fn7: (arg: T7) => T8,
): T8;
export function pipe(arg: unknown, ...fns: Array<(arg: unknown) => unknown>) {
  return fns.reduce((acc, fn) => fn(acc), arg);
}

export type Many<T> = T | Many<T>[] | undefined | null | false;

export function manyToArray<T>(arr: Many<T>): T[] {
  const result: T[] = [];
  function helper(a: Many<T>) {
    if (!a) {
      return;
    } else if (Array.isArray(a)) {
      a.forEach(helper);
    } else {
      result.push(a);
    }
  }
  helper(arr);
  return result;
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function hasKey<K extends string | number | symbol>(
  x: unknown,
  key: K,
): x is Record<K, unknown> {
  return isObject(x) && key in x;
}
