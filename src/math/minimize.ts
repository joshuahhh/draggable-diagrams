import { assert } from "../utils";

type Vector = number[];
type Matrix = number[][];

function norm2(x: Vector): number {
  return Math.sqrt(x.reduce((a, b) => a + b * b, 0));
}

function identity(n: number): Matrix {
  let ret = Array(n);
  for (let i = 0; i < n; i++) {
    ret[i] = Array(n);
    for (let j = 0; j < n; j++) ret[i][j] = +(i == j);
  }
  return ret;
}

function neg(x: Vector): Vector {
  return x.map((a) => -a);
}

function isMatrix(a: Matrix | Vector): a is Matrix {
  return typeof a[0] !== "number";
}

function dot(a: Matrix, b: Vector): Vector;
function dot(a: Vector, b: Vector): number;
function dot(a: Matrix | Vector, b: Vector): Vector | number {
  if (isMatrix(a)) {
    return a.map((x) => dot(x as Vector, b));
  }
  return a.reduce((x, y, i) => x + y * b[i], 0);
}

function sub(a: Matrix, b: Matrix): Matrix;
function sub(a: Vector, b: Vector): Vector;
function sub(a: Matrix | Vector, b: Matrix | Vector): Matrix | Vector {
  if (isMatrix(a) && isMatrix(b)) {
    return a.map((c, i) => sub(c, b[i]));
  }
  if (!isMatrix(a) && !isMatrix(b)) {
    return a.map((c, i) => c - b[i]);
  }
  throw new Error("Mismatched types in sub");
}

function add(a: Matrix, b: Matrix): Matrix;
function add(a: Vector, b: Vector): Vector;
function add(a: Matrix | Vector, b: Matrix | Vector): Matrix | Vector {
  if (isMatrix(a) && isMatrix(b)) {
    return a.map((c, i) => add(c, b[i]));
  }
  if (!isMatrix(a) && !isMatrix(b)) {
    return a.map((c, i) => c + b[i]);
  }
  throw new Error("Mismatched types in add");
}

function div(a: Matrix, b: number): Matrix {
  return a.map((c) => c.map((d) => d / b));
}

function mul(a: Matrix, b: number): Matrix;
function mul(a: Vector, b: number): Vector;
function mul(a: Matrix | Vector, b: number): Matrix | Vector {
  if (isMatrix(a)) {
    return a.map((c) => mul(c, b));
  }
  return a.map((c) => c * b);
}

function ten(a: Vector, b: Vector): Matrix {
  return a.map((c) => mul(b, c));
}

// Adapted from the numeric.js gradient and uncmin functions
// Numeric Javascript
// Copyright (C) 2011 by Sébastien Loisel

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

export function gradient(f: (x: Vector) => number, x: Vector): Vector {
  let dim = x.length,
    f1 = f(x);
  if (isNaN(f1))
    throw new Error("The gradient at [" + x.join(" ") + "] is NaN!");
  let { max, abs, min } = Math;
  let tempX = x.slice(0),
    grad = Array(dim);
  for (let i = 0; i < dim; i++) {
    let delta = max(1e-6 * f1, 1e-8);
    for (let k = 0; ; k++) {
      if (k == 20)
        throw new Error(
          "Gradient failed at index " + i + " of [" + x.join(" ") + "]",
        );
      tempX[i] = x[i] + delta;
      let f0 = f(tempX);
      tempX[i] = x[i] - delta;
      let f2 = f(tempX);
      tempX[i] = x[i];
      if (!(isNaN(f0) || isNaN(f2))) {
        grad[i] = (f0 - f2) / (2 * delta);
        let t0 = x[i] - delta;
        let t1 = x[i];
        let t2 = x[i] + delta;
        let d1 = (f0 - f1) / delta;
        let d2 = (f1 - f2) / delta;
        let err = min(
          max(abs(d1 - grad[i]), abs(d2 - grad[i]), abs(d1 - d2)),
          delta,
        );
        let normalize = max(
          abs(grad[i]),
          abs(f0),
          abs(f1),
          abs(f2),
          abs(t0),
          abs(t1),
          abs(t2),
          1e-8,
        );
        if (err / normalize < 1e-3) break; //break if this index is done
      }
      delta /= 16;
    }
  }
  return grad;
}

export function minimize(
  f: (x: Vector) => number,
  x0: Vector,
  end_on_line_search = true,
  tol = 1e-8,
  maxit = 1000,
) {
  tol = Math.max(tol, 2e-16);
  let grad = (a: Vector) => gradient(f, a);

  x0 = x0.slice(0);
  let g0 = grad(x0);
  let f0 = f(x0);
  if (isNaN(f0)) throw new Error("minimize: f(x0) is a NaN!");
  let n = x0.length;
  let H1 = identity(n);
  let msg: string | undefined = undefined;
  let it: number;
  for (it = 0; it < maxit; it++) {
    if (!g0.every(isFinite)) {
      msg = "Gradient has Infinity or NaN";
      break;
    }
    let step = neg(dot(H1, g0));
    if (!step.every(isFinite)) {
      msg = "Search direction has Infinity or NaN";
      break;
    }
    let nstep = norm2(step);
    if (nstep < tol) {
      msg = "Newton step smaller than tol";
      break;
    }
    let t = 1;
    let df0 = dot(g0, step);
    // line search
    let x1 = x0;
    let s: Vector | undefined;
    let f1: number;
    for (; it < maxit && t * nstep >= tol; it++) {
      s = mul(step, t);
      x1 = add(x0, s);
      f1 = f(x1);
      if (!(f1 - f0 >= 0.1 * t * df0 || isNaN(f1))) break;
      t *= 0.5;
    }
    assert(!!s);
    if (t * nstep < tol && end_on_line_search) {
      msg = "Line search step size smaller than tol";
      break;
    }
    if (it === maxit) {
      msg = "maxit reached during line search";
      break;
    }
    let g1 = grad(x1);
    let y = sub(g1, g0);
    let ys = dot(y, s);
    let Hy = dot(H1, y);
    H1 = sub(
      add(H1, mul(ten(s, s), (ys + dot(y, Hy)) / (ys * ys))),
      div(add(ten(Hy, s), ten(s, Hy)), ys),
    );
    x0 = x1;
    f0 = f1!;
    g0 = g1;
  }

  return {
    solution: x0,
    f: f0,
    gradient: g0,
    invHessian: H1,
    iterations: it,
    message: msg,
  };
}

// let x = [4,26,2,8]
// minimize(norm2, x).f *1e9
// 8.597
