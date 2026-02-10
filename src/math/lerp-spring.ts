export type LerpFn<P> = (a: P, b: P, t: number) => P;

export interface LerpSpringParams {
  omega: number; // spring frequency (rad/s)
  gamma: number; // damping rate (1/s)
}

export class LerpSpring<P> {
  private prev: P; // x_{n-1}
  private cur: P; // x_n
  private prevT: number; // t_{n-1}
  private curT: number; // t_n

  private readonly lerp: LerpFn<P>;
  private readonly omega: number;
  private readonly gamma: number;

  constructor(opts: {
    initial: P;
    time: number;
    params: LerpSpringParams;
    lerp: LerpFn<P>;
  }) {
    this.prev = opts.initial;
    this.cur = opts.initial;
    this.prevT = opts.time;
    this.curT = opts.time;

    this.lerp = opts.lerp;
    this.omega = opts.params.omega;
    this.gamma = opts.params.gamma;
  }

  /**
   * Advance the spring to `newT` toward `target`.
   * Returns the new position.
   */
  step(newT: number, target: P): P {
    const { lerp, omega, gamma } = this;

    let dt = newT - this.curT; // Δt_n
    let dtPrev = this.curT - this.prevT; // Δt_{n-1}

    // No time progress: do nothing.
    if (dt <= 0) {
      return this.cur;
    }

    // First real step: fake a previous point with zero velocity.
    if (dtPrev <= 0) {
      this.prev = this.cur;
      this.prevT = this.curT - dt;
      dtPrev = dt; // makes alpha = (dt / dtPrev) = 1
    }

    const velDamp = Math.exp(-gamma * dt);
    const alpha = (dt / dtPrev) * velDamp; // momentum term
    const beta = omega * dt * (omega * dt); // spring term = (ω Δt)^2

    const next = LerpSpring.affine3(
      this.prev,
      -alpha,
      this.cur,
      1 + alpha - beta,
      target,
      beta,
      lerp,
    );

    // Shift state forward
    this.prev = this.cur;
    this.cur = next;
    this.prevT = this.curT;
    this.curT = newT;

    return this.cur;
  }

  // wA*A + wB*B + wC*C, assuming wA + wB + wC === 1
  private static affine3<P>(
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
}
