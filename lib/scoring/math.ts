/** Restrict a value to an inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Distance decay: 1 at the doorstep, falling away sharply past the scale.
 * exp(-5 * (d / scale)^5) — the curve Walk Score popularised.
 */
export function decay(distanceM: number, scaleM: number): number {
  if (distanceM <= 0) return 1;
  if (scaleM <= 0) return 0;
  return Math.exp(-5 * Math.pow(distanceM / scaleM, 5));
}

/** Normalise a count to [0,1] against a saturation cap. */
export function norm(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return clamp(value / cap, 0, 1);
}
