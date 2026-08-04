/** Restrict a value to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Distance decay: 1 at the doorstep, falling away smoothly past the scale.
 * exp(-(d / scale)^1.5). An earlier exp(-5·(d/scale)^5) curve was effectively
 * a step function — e.g. at scale 1300 it returned 0.96 at 500m but 0.007 at
 * 1300m, so everything inside the knee counted identically and the curve did
 * no real discriminating work.
 */
export function decay(distanceM: number, scaleM: number): number {
  if (distanceM <= 0) return 1;
  if (scaleM <= 0) return 0;
  return Math.exp(-Math.pow(distanceM / scaleM, 1.5));
}

/** Normalise a count to [0,1] against a saturation cap. */
export function norm(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(value / cap, 0, 1);
}
