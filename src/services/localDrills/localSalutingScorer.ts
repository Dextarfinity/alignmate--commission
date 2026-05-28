/**
 * Local Saluting Scorer — Template-Matching Engine
 *
 * Methodology Note (Chapter 3):
 * Evaluates the Hand Salute for snapshot analysis via the local ONNX pipeline.
 * Uses additive scoring with body-relative checks, then applies hard gates
 * for missing core salute signatures.
 */

import type { PoseKeypoint } from "./templateGeometry";
import { jointAngle, segmentAngleFromHorizontal } from "../../utils/angleUtils";

interface ScoringResult {
  score: number;
  scoreCap: number;
  feedback: string[];
  recommendations: string[];
  perfectCriticalChecksPassed: boolean;
}

export function scoreLocalSalutation(
  keypoints: PoseKeypoint[],
  headPoint: PoseKeypoint | undefined,
  visibleKeypoints: PoseKeypoint[],
  avgConfidence: number,
): ScoringResult {
  let score = 0;
  let scoreCap = 100;
  const feedback: string[] = [];
  const recommendations: string[] = [];

  const isVisible = (kp: PoseKeypoint | undefined, min = 0.35): kp is PoseKeypoint =>
    Boolean(kp && kp.confidence >= min);

  const kpByName = new Map(keypoints.map(kp => [kp.name, kp]));
  const get = (name: string) => kpByName.get(name);

  const leftShoulder = get("left_shoulder"), rightShoulder = get("right_shoulder");
  const leftElbow = get("left_elbow"), rightElbow = get("right_elbow");
  const leftWrist = get("left_wrist"), rightWrist = get("right_wrist");
  const leftHip = get("left_hip"), rightHip = get("right_hip");

  const calculateAngle = (a: PoseKeypoint, b: PoseKeypoint, c: PoseKeypoint) => jointAngle(a, b, c);

  const addScore = (pts: number, goodText: string, recText?: string) => {
    score += pts;
    if (goodText) feedback.push(goodText);
    if (recText) recommendations.push(recText);
  };

  let saluteHandOnTarget = false;
  let saluteElbowUpperArmCorrect = false;
  let saluteForearm45 = false;
  let looksLikeAttention = false;
  let saluteBaseBearingStrong = false;

  // 1) Base attention posture while saluting (40)
  if (isVisible(leftHip, 0.35) && isVisible(rightHip, 0.35) && isVisible(leftShoulder, 0.35) && isVisible(rightShoulder, 0.35)) {
    let base = 0;
    if (Math.abs(leftShoulder.y - rightShoulder.y) < 0.04) base += 12;
    if (Math.abs(leftHip.y - rightHip.y) < 0.04) base += 10;
    if (isVisible(headPoint, 0.35)) {
      const hipCX = (leftHip.x + rightHip.x) / 2;
      if (Math.abs(headPoint!.x - hipCX) < 0.06) base += 10;
    }
    if (isVisible(leftWrist, 0.35) && isVisible(leftElbow, 0.35) && isVisible(leftShoulder, 0.35)) {
      const lArmAng = calculateAngle(leftShoulder, leftElbow, leftWrist);
      if (lArmAng > 155 && leftWrist.y > leftHip.y - 0.02) base += 8;
    }
    score += Math.min(40, base);
    saluteBaseBearingStrong = base >= 30;
    if (base >= 30) feedback.push("✓ Maintains attention posture while saluting");
    else recommendations.push("Maintain attention posture while rendering salute");
  }

  // 2) Right hand to visor/right eye area (25)
  if (isVisible(rightWrist, 0.4) && isVisible(headPoint, 0.35) && isVisible(rightShoulder, 0.4)) {
    const wristNearForehead = rightWrist.y <= headPoint!.y + 0.02 && rightWrist.y >= headPoint!.y - 0.14;
    const wristRaised = rightWrist.y < rightShoulder.y;
    const wristNearRightFace = Math.abs(rightWrist.x - headPoint!.x) < 0.18;
    saluteHandOnTarget = wristNearForehead && wristRaised && wristNearRightFace;
    if (saluteHandOnTarget) addScore(25, "✓ Right hand at proper salute point");
    else if (wristRaised) addScore(12, "", "Place right forefinger near visor/right eyebrow level");
    else recommendations.push("Raise right hand sharply to salute position");
  }

  // 3) Elbow forward / upper arm near horizontal (20)
  if (isVisible(rightShoulder, 0.4) && isVisible(rightElbow, 0.4) && isVisible(rightWrist, 0.4)) {
    const upperArmH = Math.abs(rightElbow.y - rightShoulder.y) < 0.07;
    const elbowAway = Math.abs(rightElbow.x - rightShoulder.x) > 0.05;
    saluteElbowUpperArmCorrect = upperArmH && elbowAway;
    if (upperArmH && elbowAway) addScore(20, "✓ Elbow position and upper arm are correct");
    else if (upperArmH || elbowAway) addScore(10, "", "Keep elbow slightly forward and upper arm near horizontal");
    else recommendations.push("Set elbow slightly forward with upper arm horizontal");
  }

  // 4) Forearm at about 45 degrees (10)
  if (isVisible(rightElbow, 0.4) && isVisible(rightWrist, 0.4)) {
    const forearmAngle = segmentAngleFromHorizontal(rightElbow, rightWrist);
    saluteForearm45 = forearmAngle >= 35 && forearmAngle <= 60;
    if (forearmAngle >= 35 && forearmAngle <= 60) addScore(10, "✓ Forearm angle is near 45 degrees");
    else if (forearmAngle >= 25 && forearmAngle <= 70) addScore(5, "", "Adjust forearm to approximately 45 degrees");
    else recommendations.push("Forearm should be inclined around 45 degrees");
  }

  // 5) Visibility bonus (5)
  if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) addScore(5, "✓ Full body clearly visible");

  // Detect attention being graded as salute
  if (isVisible(leftWrist, 0.35) && isVisible(rightWrist, 0.35) && isVisible(leftHip, 0.35) && isVisible(rightHip, 0.35) && isVisible(rightShoulder, 0.35)) {
    const bothAtSides = Math.abs(leftWrist.x - leftHip.x) < 0.14 && Math.abs(rightWrist.x - rightHip.x) < 0.14 &&
      leftWrist.y > leftHip.y - 0.02 && rightWrist.y > rightHip.y - 0.02;
    const rightHandNotRaised = rightWrist.y >= rightShoulder.y - 0.02;
    looksLikeAttention = bothAtSides && rightHandNotRaised;
  }

  // Hard gates
  if (!saluteHandOnTarget) { scoreCap = Math.min(scoreCap, 45); recommendations.push("Salute requires right forefinger near visor/right eye level"); }
  if (!saluteElbowUpperArmCorrect) scoreCap = Math.min(scoreCap, 55);
  if (!saluteForearm45) scoreCap = Math.min(scoreCap, 70);
  if (looksLikeAttention) { scoreCap = Math.min(scoreCap, 35); recommendations.push("Detected attention stance; raise right hand to proper salute"); }

  const perfectCriticalChecksPassed = saluteBaseBearingStrong && saluteHandOnTarget && saluteElbowUpperArmCorrect && saluteForearm45 && !looksLikeAttention && scoreCap === 100;

  return { score, scoreCap, feedback, recommendations, perfectCriticalChecksPassed };
}
