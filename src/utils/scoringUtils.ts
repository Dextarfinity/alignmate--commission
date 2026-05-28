/**
 * Scoring Utility Functions
 *
 * Methodology Note (Chapter 3):
 * These helpers implement the cross-cutting scoring logic shared by all
 * drill evaluators:
 * - Visibility gates prevent inflated scores when too few landmarks are detected
 * - Score blending combines distance-based and rule-based scores
 * - Side-view detection adjusts blending weights for oblique camera angles
 */

import type { CustomKeypoint } from "../drills/types";
import { KP } from "../drills/types";

// ---------------------------------------------------------------------------
// Visibility Quality Gates
// ---------------------------------------------------------------------------

/**
 * Applies visibility-based score caps.
 *
 * Methodology Note (Chapter 3):
 * When fewer than 12 body landmarks are confidently detected, the system
 * cannot reliably assess full-body posture. The cap prevents false highs.
 *
 * @param visibleCount - Number of keypoints with confidence > threshold
 * @param currentCap   - Current score cap
 * @returns Updated score cap
 */
export function applyVisibilityGate(
  visibleCount: number,
  currentCap: number,
): number {
  if (visibleCount < 8) return Math.min(currentCap, 30);
  if (visibleCount < 10) return Math.min(currentCap, 50);
  if (visibleCount < 12) return Math.min(currentCap, 70);
  return currentCap;
}

// ---------------------------------------------------------------------------
// Side-View Detection
// ---------------------------------------------------------------------------

/**
 * Detects whether the user is standing at a side angle to the camera.
 *
 * If the body appears narrow in the x-axis relative to the torso height,
 * the user is likely in profile view. This affects scoring blend weights.
 *
 * @param keypoints - Custom 17-point keypoints
 * @returns true if side-view is detected
 */
export function detectSideView(keypoints: CustomKeypoint[]): boolean {
  const visible = (index: number, min = 0.3) => {
    const kp = keypoints[index];
    return Boolean(kp && kp.confidence > min);
  };

  if (
    visible(KP.HEAD, 0.35) &&
    visible(KP.HIPS_CENTER, 0.35) &&
    visible(KP.LEFT_SHOULDER, 0.3) &&
    visible(KP.RIGHT_SHOULDER, 0.3) &&
    visible(KP.LEFT_HIP, 0.3) &&
    visible(KP.RIGHT_HIP, 0.3)
  ) {
    const head = keypoints[KP.HEAD];
    const hips = keypoints[KP.HIPS_CENTER];
    const torsoHeight = Math.max(0.12, Math.abs(hips.y - head.y));
    const shoulderWidth = Math.abs(
      keypoints[KP.LEFT_SHOULDER].x - keypoints[KP.RIGHT_SHOULDER].x,
    );
    const hipWidth = Math.abs(
      keypoints[KP.LEFT_HIP].x - keypoints[KP.RIGHT_HIP].x,
    );
    const bodyWidthRatio = Math.max(shoulderWidth, hipWidth) / torsoHeight;
    return bodyWidthRatio < 0.24;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Score Blending
// ---------------------------------------------------------------------------

/**
 * Blends the distance-based score with the deduction-based rule score.
 *
 * Methodology Note (Chapter 3):
 * Two complementary scoring approaches are combined:
 * - Distance score: average Euclidean distance from ideal keypoint positions
 * - Rule score: deduction-based evaluation of specific drill requirements
 *
 * The blend weights vary by posture type:
 * - Drill postures (attention, salutation, marching): 85% rule, 15% distance
 * - Side-view: 65% rule, 35% distance
 * - Other: 30% rule, 70% distance
 *
 * @param distanceScore - Score derived from average keypoint distance to ideal
 * @param ruleScore     - Score derived from drill-specific deductions
 * @param postureType   - Current drill type
 * @param isSideView    - Whether the user is in profile view
 * @returns Blended score
 */
export function blendScores(
  distanceScore: number,
  ruleScore: number,
  postureType: string,
  isSideView: boolean,
): number {
  if (
    (postureType === "attention" ||
      postureType === "salutation" ||
      postureType === "marching") &&
    ruleScore >= 0
  ) {
    return distanceScore * 0.15 + ruleScore * 0.85;
  }

  if (isSideView && ruleScore > 0) {
    return distanceScore * 0.35 + ruleScore * 0.65;
  }

  if (ruleScore > 0) {
    return distanceScore * 0.7 + ruleScore * 0.3;
  }

  return distanceScore;
}

/**
 * Computes the distance-based base score from custom keypoints vs ideal.
 *
 * @param customKeypoints - Detected custom keypoints
 * @param ideal           - Ideal reference keypoints
 * @returns Base distance score 0-100, and the count of valid points
 */
export function computeDistanceScore(
  customKeypoints: CustomKeypoint[],
  ideal: { x: number; y: number; confidence: number; name: string }[],
): { score: number; validPoints: number } {
  let totalDistance = 0;
  let validPoints = 0;

  for (let i = 0; i < Math.min(customKeypoints.length, ideal.length); i++) {
    const current = customKeypoints[i];
    const idealPoint = ideal[i];

    if (current.confidence > 0.3) {
      const dx = current.x - idealPoint.x;
      const dy = current.y - idealPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalDistance += distance;
      validPoints++;
    }
  }

  if (validPoints === 0) {
    return { score: 0, validPoints: 0 };
  }

  const averageDistance = totalDistance / validPoints;
  const score = Math.max(0, Math.min(100, 100 - averageDistance * 100));
  return { score, validPoints };
}

/**
 * Clamps a score to [0, cap] and rounds to integer.
 */
export function clampScore(score: number, cap: number): number {
  return Math.round(Math.min(score, cap));
}

/**
 * Confidence-based multiplier for the template-matching engine.
 *
 * Methodology Note (Chapter 3):
 * Keeps strong form from being over-penalized at medium/high confidence.
 * Below 0.45 confidence, the multiplier scales linearly. Between 0.45
 * and 0.65, a gentler ramp is applied. Above 0.65, full score is used.
 */
export function getConfidenceMultiplier(avgConfidence: number): number {
  if (avgConfidence < 0.45) {
    return Math.max(0.45, avgConfidence / 0.45);
  } else if (avgConfidence < 0.65) {
    return 0.92 + (avgConfidence - 0.45) * 0.35;
  }
  return 1.0;
}
