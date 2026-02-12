import { memo, ReactNode } from "react";
import { ErrorWithJSX } from "./ErrorBoundary";

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

export function assertDefined<T>(
  x: T | undefined | null,
  msg?: string | (() => void),
): T {
  if (x === undefined || x === null) {
    if (typeof msg === "function") {
      console.group("Assertion failed; debug info:");
      msg();
      console.groupEnd();
      throw new Error("Assertion failed: value is undefined or null");
    } else {
      throw new Error(msg ?? "Assertion failed: value is undefined or null");
    }
  }
  return x;
}

export function assertWithJSX(
  condition: boolean,
  msg: string,
  jsx: () => ReactNode,
): asserts condition {
  if (!condition) {
    throw new ErrorWithJSX(msg, jsx());
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

export function pipe<T>(arg: T): T;
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

export function hasType(x: unknown, type: string): boolean {
  return isObject(x) && hasKey(x, "type") && x.type === type;
}

export function emptyToUndefined<T>(arr: T[]): T[] | undefined {
  return arr.length === 0 ? undefined : arr;
}

export function noOp(): void {}

export function throwError(): never {
  throw new Error("This function should not have been called");
}

/**
 * "Distributive" version of Omit, which works on union types.
 */
export type DOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

/**
 * version of React.memo that works with generic components, maybe.
 */
export const memoGeneric = <C extends (...props: any) => ReactNode>(c: C) =>
  memo(c as any) as unknown as C;

export function uPairs<T>(l: T[]): [T, T][] {
  const result: [T, T][] = [];
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      result.push([l[i], l[j]]);
    }
  }
  return result;
}

/**
 * Make a function that can be called either directly or as a template literal tag
 */
export function templateLiteralTagOrNot<R>(fn: (input: string) => R) {
  function wrapper(s: string): R;
  function wrapper(strings: TemplateStringsArray, ...values: unknown[]): R;
  function wrapper(a: any, ...rest: any[]): R {
    if (typeof a === "string") {
      return fn(a);
    } else {
      // Called as a template literal tag
      let out = a[0];
      for (let i = 0; i < rest.length; i++) {
        out += String(rest[i]) + a[i + 1];
      }
      return fn(out);
    }
  }
  return wrapper;
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

export function objectEntries<T extends object>(obj: T): Entries<T> {
  return Object.entries(obj) as Entries<T>;
}
