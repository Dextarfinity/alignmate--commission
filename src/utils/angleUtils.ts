/**
 * Angle Utility Functions
 *
 * Methodology Note (Chapter 3):
 * These are the fundamental geometric primitives used by all drill
 * evaluators. Joint angles are computed using the atan2-based method
 * which handles all quadrants correctly and returns degrees in [0, 180].
 *
 * Per Philippine Army Manual 8-0107, joint angles determine correct
 * drill form — e.g. elbow angle for salute, knee angle for attention.
 */

/**
 * Computes the angle (in degrees) at joint B formed by segments BA and BC.
 *
 * @param a - First endpoint (e.g. shoulder)
 * @param b - Vertex / joint (e.g. elbow)
 * @param c - Second endpoint (e.g. wrist)
 * @returns Angle in degrees [0, 180]
 */
export function jointAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

/**
 * Computes the angle of segment AB from the horizontal axis.
 * Returns a value in [0, 90] regardless of direction.
 *
 * Used by the template-matching engine to check forearm inclination
 * during salutation (~45° is correct per PA Manual 8-0107).
 *
 * @param a - Start point
 * @param b - End point
 * @returns Angle from horizontal in degrees [0, 90]
 */
export function segmentAngleFromHorizontal(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const angle = Math.abs((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  return angle > 90 ? 180 - angle : angle;
}

/**
 * Clamps a value to the unit interval [0, 1].
 */
export function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}
