/**
 * Local Marching Scorer — Template-Matching Engine
 *
 * Methodology Note (Chapter 3):
 * Evaluates marching-in-place for snapshot analysis via the local ONNX pipeline.
 * Uses K1-K2 marching geometry for leg lift detection, combined with
 * torso/arm/head checks and temporal cadence analysis.
 */

import type { PoseKeypoint, MarchingGeometryMetrics } from "./templateGeometry";

interface ScoringResult {
  score: number;
  scoreCap: number;
  feedback: string[];
  recommendations: string[];
  perfectCriticalChecksPassed: boolean;
  marchingLegLiftDetectedInFrame: boolean;
  marchingPassQualified: boolean;
  marchingFormSignalCount: number;
}

export function scoreLocalMarching(
  keypoints: PoseKeypoint[],
  headPoint: PoseKeypoint | undefined,
  visibleKeypoints: PoseKeypoint[],
  avgConfidence: number,
  marchingGeometry: MarchingGeometryMetrics,
): ScoringResult {
  let score = 0;
  let scoreCap = 100;
  const feedback: string[] = [];
  const recommendations: string[] = [];
  let marchingLegLiftDetectedInFrame = false;
  let marchingPassQualified = false;

  const isVisible = (
    kp: PoseKeypoint | undefined,
    min = 0.35,
  ): kp is PoseKeypoint => Boolean(kp && kp.confidence >= min);

  const kpByName = new Map(keypoints.map((kp) => [kp.name, kp]));
  const get = (name: string) => kpByName.get(name);

  const leftShoulder = get("left_shoulder"),
    rightShoulder = get("right_shoulder");
  const leftWrist = get("left_wrist"),
    rightWrist = get("right_wrist");
  const leftHip = get("left_hip"),
    rightHip = get("right_hip");
  const leftKnee = get("left_knee"),
    rightKnee = get("right_knee");
  const leftAnkle = get("left_ankle"),
    rightAnkle = get("right_ankle");

  const addScore = (pts: number, goodText: string, recText?: string) => {
    score += pts;
    if (goodText) feedback.push(goodText);
    if (recText) recommendations.push(recText);
  };

  let marchingLegLiftDetected = false;
  let marchingLegLiftPartial = false;
  let marchingFootLiftDetected = false;
  let marchingSupportStrong = false;
  let marchingTorsoStrong = false;
  let marchingArmsStrong = false;

  // Direct foot-off-ground check
  if (isVisible(leftAnkle, 0.35) && isVisible(rightAnkle, 0.35)) {
    const ankleHeightDiff = Math.abs(leftAnkle.y - rightAnkle.y);
    const kneeHeightDiff =
      isVisible(leftKnee, 0.35) && isVisible(rightKnee, 0.35)
        ? Math.abs(leftKnee.y - rightKnee.y)
        : 0;
    if (ankleHeightDiff >= 0.025 || kneeHeightDiff >= 0.02) {
      marchingFootLiftDetected = true;
      marchingPassQualified = true;
    }
  }

  // 1) K1-K2 geometry (30)
  if (marchingGeometry.hasRequiredKeypoints) {
    marchingLegLiftDetected =
      marchingGeometry.phase !== "none" &&
      marchingGeometry.liftQuality >= 0.42 &&
      marchingGeometry.liftClarity >= 0.3;
    marchingLegLiftPartial =
      marchingGeometry.phase !== "none" && marchingGeometry.liftQuality >= 0.24;
    marchingLegLiftDetectedInFrame = marchingLegLiftDetected;

    if (marchingLegLiftDetected) {
      marchingPassQualified = true;
      addScore(30, "✓ K1-K2 marching lift is clear and disciplined");
    } else if (marchingFootLiftDetected)
      addScore(24, "✓ Foot is clearly lifted off the ground");
    else if (marchingLegLiftPartial)
      addScore(
        18,
        "",
        "Raise K2 higher above K1 to make each marching phase clearer",
      );
    else {
      addScore(
        10,
        "",
        "Increase knee lift so the K1-K2 triangle shows clear vertical rise",
      );
      recommendations.push("Lift each leg higher during march in place");
    }

    if (
      marchingGeometry.riseRunScore < 0.45 &&
      marchingGeometry.phase !== "none"
    )
      recommendations.push(
        "Keep knee lift mostly upward; avoid excessive sideways drift",
      );
  } else {
    recommendations.push(
      "Ensure hips, knees, and ankles are visible for K1-K2 marching analysis",
    );
  }

  // 2) Supporting leg straight (20)
  if (marchingGeometry.hasRequiredKeypoints) {
    if (marchingGeometry.supportQuality >= 0.75) {
      marchingSupportStrong = true;
      addScore(20, "✓ Supporting leg stays straight and controlled");
    } else if (marchingGeometry.supportQuality >= 0.5)
      addScore(12, "", "Keep the supporting leg straighter");
    else
      recommendations.push("Avoid bending the supporting knee while marching");
  }

  // 3) Torso erect (20)
  if (
    isVisible(headPoint, 0.35) &&
    isVisible(leftHip, 0.35) &&
    isVisible(rightHip, 0.35) &&
    isVisible(leftShoulder, 0.35) &&
    isVisible(rightShoulder, 0.35)
  ) {
    const hipCX = (leftHip.x + rightHip.x) / 2;
    const sDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    const torsoAligned = Math.abs(headPoint!.x - hipCX) < 0.08;
    if (torsoAligned && sDiff < 0.05) {
      marchingTorsoStrong = true;
      addScore(20, "✓ Torso stays upright while marching");
    } else if (torsoAligned || sDiff < 0.05)
      addScore(10, "", "Keep body erect and eyes front during march");
    else
      recommendations.push("Maintain upright military bearing while marching");
  }

  // 4) Arms at sides (15)
  if (
    isVisible(leftWrist, 0.35) &&
    isVisible(rightWrist, 0.35) &&
    isVisible(leftHip, 0.35) &&
    isVisible(rightHip, 0.35)
  ) {
    const lAtSide = Math.abs(leftWrist.x - leftHip.x) < 0.16;
    const rAtSide = Math.abs(rightWrist.x - rightHip.x) < 0.16;
    if (lAtSide && rAtSide) {
      marchingArmsStrong = true;
      addScore(15, "✓ Arms remain at sides");
    } else if (lAtSide || rAtSide)
      addScore(8, "", "Keep both arms at your sides while marching");
    else recommendations.push("Arms should stay at sides as in attention");
  }

  // 5) Frame quality (15)
  if (visibleKeypoints.length >= 14 && avgConfidence > 0.7)
    addScore(15, "✓ Marching posture clearly visible");
  else if (visibleKeypoints.length >= 10 && avgConfidence > 0.5)
    addScore(
      8,
      "",
      "Improve framing and lighting for more accurate marching score",
    );
  else
    recommendations.push("Ensure full body is visible for marching assessment");

  // Hard gate
  if (!marchingLegLiftDetected && !marchingFootLiftDetected) {
    if (marchingLegLiftPartial) {
      scoreCap = Math.min(scoreCap, 78);
      recommendations.push("Leg lift is present but not yet clear enough");
    } else {
      scoreCap = Math.min(scoreCap, 62);
      recommendations.push(
        "Marching in place requires clear alternating leg lift",
      );
    }
  }

  const perfectCriticalChecksPassed =
    marchingLegLiftDetected &&
    marchingSupportStrong &&
    marchingTorsoStrong &&
    marchingArmsStrong &&
    scoreCap === 100;
  const marchingFormSignalCount = [
    marchingSupportStrong,
    marchingTorsoStrong,
    marchingArmsStrong,
  ].filter(Boolean).length;

  return {
    score,
    scoreCap,
    feedback,
    recommendations,
    perfectCriticalChecksPassed,
    marchingLegLiftDetectedInFrame,
    marchingPassQualified,
    marchingFormSignalCount,
  };
}
