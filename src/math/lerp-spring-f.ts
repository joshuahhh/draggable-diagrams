export type LerpFn<P> = (a: P, b: P, t: number) => P;

export interface LerpSpringParams {
  omega: number; // spring frequency (rad/s)
  gamma: number; // damping rate (1/s)
}

export interface LerpSpringState<P> {
  prev: P; // x_{n-1}
  cur: P; // x_n
  prevT: number; // t_{n-1}
  curT: number; // t_n
}

/**
 * Create initial spring state.
 */
export function createLerpSpringState<P>(
  initial: P,
  time: number,
): LerpSpringState<P> {
  return {
    prev: initial,
    cur: initial,
    prevT: time,
    curT: time,
  };
}

/**
 * Advance the spring to `newT` toward `target`.
 * Returns the new state.
 */
export function step<P>(
  state: LerpSpringState<P>,
  params: LerpSpringParams,
  lerp: LerpFn<P>,
  newT: number,
  target: P,
): LerpSpringState<P> {
  const { omega, gamma } = params;

  let dt = newT - state.curT; // Δt_n
  let dtPrev = state.curT - state.prevT; // Δt_{n-1}

  // No time progress: do nothing.
  if (dt <= 0) {
    return state;
  }

  let prev = state.prev;

  // First real step: fake a previous point with zero velocity.
  if (dtPrev <= 0) {
    prev = state.cur;
    dtPrev = dt; // makes alpha = (dt / dtPrev) = 1
  }

  const velDamp = Math.exp(-gamma * dt);
  const alpha = (dt / dtPrev) * velDamp; // momentum term
  const beta = omega * dt * (omega * dt); // spring term = (ω Δt)^2

  const next = affine3(
    prev,
    -alpha,
    state.cur,
    1 + alpha - beta,
    target,
    beta,
    lerp,
  );

  // Return new state
  return {
    prev: state.cur,
    cur: next,
    prevT: state.curT,
    curT: newT,
  };
}

/**
 * Compute wA*A + wB*B + wC*C, assuming wA + wB + wC === 1
 */
function affine3<P>(
  A: P,
  wA: number,
  B: P,
  wB: number,
  C: P,
  wC: number,
  lerp: LerpFn<P>,
): P {
  // Prefer combining A+B; if degenerate, combine B+C instead.
  const sumAB = wA + wB;

  if (Math.abs(sumAB) > 1e-8) {
    // AB = (wA*A + wB*B) / (wA + wB)
    const AB = lerp(A, B, wB / sumAB);
    // result = (1 - wC)*AB + wC*C   (since wA + wB + wC = 1)
    return lerp(AB, C, wC);
  } else {
    // Fallback: combine B+C first
    const sumBC = wB + wC; // = 1 - wA
    const BC = lerp(B, C, wC / sumBC);
    // result = (1 - wA)*BC + wA*A
    return lerp(BC, A, wA);
  }
}
