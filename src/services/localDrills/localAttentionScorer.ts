/**
 * Local Attention Scorer — Template-Matching Engine
 *
 * Methodology Note (Chapter 3):
 * This scorer implements the attention posture evaluation used by the
 * local ONNX pipeline for snapshot analysis. It uses a deduction-based
 * approach with body-relative thresholds, then blends with cosine
 * template similarity for robust scoring.
 */

import type { PoseKeypoint } from "./templateGeometry";
import { jointAngle } from "../../utils/angleUtils";

interface ScoringResult {
  score: number;
  scoreCap: number;
  feedback: string[];
  recommendations: string[];
  perfectCriticalChecksPassed: boolean;
}

export function scoreLocalAttention(
  keypoints: PoseKeypoint[],
  headPoint: PoseKeypoint | undefined,
  visibleKeypoints: PoseKeypoint[],
  avgConfidence: number,
): ScoringResult {
  let score = 0;
  let scoreCap = 100;
  const feedback: string[] = [];
  const recommendations: string[] = [];
  let attentionDeductions = 0;
  let hardFail = false;

  const isVisible = (kp: PoseKeypoint | undefined, min = 0.35): kp is PoseKeypoint =>
    Boolean(kp && kp.confidence >= min);

  const kpByName = new Map(keypoints.map(kp => [kp.name, kp]));
  const get = (name: string) => kpByName.get(name);

  const nose = get("nose"), leftEye = get("left_eye"), rightEye = get("right_eye");
  const leftEar = get("left_ear"), rightEar = get("right_ear");
  const leftShoulder = get("left_shoulder"), rightShoulder = get("right_shoulder");
  const leftElbow = get("left_elbow"), rightElbow = get("right_elbow");
  const leftWrist = get("left_wrist"), rightWrist = get("right_wrist");
  const leftHip = get("left_hip"), rightHip = get("right_hip");
  const leftKnee = get("left_knee"), rightKnee = get("right_knee");
  const leftAnkle = get("left_ankle"), rightAnkle = get("right_ankle");

  const calculateAngle = (a: PoseKeypoint, b: PoseKeypoint, c: PoseKeypoint) => jointAngle(a, b, c);

  // --- HEAD ---
  if (isVisible(headPoint, 0.35) && isVisible(leftShoulder, 0.35) && isVisible(rightShoulder, 0.35)) {
    const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
    const headOffset = Math.abs(headPoint!.x - shoulderCenterX);
    let headDed = 0, headMsg = "✓ Head erect, facing front";

    if (headOffset >= 0.10) { headDed = 20; hardFail = true; headMsg = "Head must face straight forward"; }
    else if (headOffset >= 0.06) { headDed = 20; headMsg = "Keep head centered and facing forward"; }
    else if (headOffset >= 0.04) { headDed = 10; headMsg = "Slight head adjustment needed"; }

    // Head rotation via ear/eye asymmetry
    const lEarC = leftEar?.confidence ?? 0, rEarC = rightEar?.confidence ?? 0;
    const lEyeC = leftEye?.confidence ?? 0, rEyeC = rightEye?.confidence ?? 0;
    const noseC = nose?.confidence ?? 0;

    const earAsym = (lEarC > 0.15 || rEarC > 0.15) && (Math.abs(lEarC - rEarC) > 0.35 || Math.min(lEarC, rEarC) < 0.15);
    const eyeAsym = (lEyeC > 0.2 || rEyeC > 0.2) && Math.abs(lEyeC - rEyeC) > 0.3;

    let noseEyeOff = 0;
    if (noseC > 0.3 && lEyeC > 0.25 && rEyeC > 0.25 && nose && leftEye && rightEye) {
      const eyeMidX = (leftEye.x + rightEye.x) / 2;
      const eyeSpan = Math.abs(leftEye.x - rightEye.x);
      if (eyeSpan > 0) noseEyeOff = Math.abs(nose.x - eyeMidX) / eyeSpan;
    }

    let headTilted = false;
    if (lEyeC > 0.3 && rEyeC > 0.3 && leftEye && rightEye) {
      const eyeYD = Math.abs(leftEye.y - rightEye.y);
      const eyeXS = Math.abs(leftEye.x - rightEye.x);
      if (eyeXS > 0 && eyeYD / eyeXS > 0.35) headTilted = true;
    }

    const headRotated = earAsym || eyeAsym || noseEyeOff > 0.35;
    const headStronglyRotated = (earAsym && eyeAsym) || noseEyeOff > 0.55;

    if (headStronglyRotated && headDed < 20) { headDed = 20; headMsg = "Face straight forward"; }
    else if (headRotated && headDed < 15) { headDed = 15; headMsg = "Keep your head level and face forward"; }
    if (headTilted && headDed < 10) { headDed = Math.max(headDed, 10); headMsg = "Keep your head level"; }

    attentionDeductions += headDed;
    if (headDed > 0) recommendations.push(headMsg);
    else feedback.push(headMsg);
  }

  // --- SHOULDERS ---
  if (isVisible(leftShoulder, 0.4) && isVisible(rightShoulder, 0.4)) {
    const sDiff = Math.abs(leftShoulder.y - rightShoulder.y);
    if (sDiff >= 0.06) { attentionDeductions += 15; recommendations.push("Keep shoulders even and square"); }
    else if (sDiff >= 0.035) { attentionDeductions += 8; recommendations.push("Level your shoulders"); }
    else feedback.push("✓ Shoulders square and level");
  }

  // --- ARMS ---
  let armSignatureReliable = false;
  if (isVisible(leftShoulder, 0.35) && isVisible(leftElbow, 0.35) && isVisible(leftWrist, 0.35) &&
      isVisible(rightShoulder, 0.35) && isVisible(rightElbow, 0.35) && isVisible(rightWrist, 0.35) &&
      isVisible(leftHip, 0.35) && isVisible(rightHip, 0.35)) {
    armSignatureReliable = true;
    const shoulderW = Math.abs(leftShoulder.x - rightShoulder.x);
    const hipCenterY = (leftHip.y + rightHip.y) / 2;
    const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
    const torsoH = Math.max(0.05, Math.abs(hipCenterY - shoulderCenterY));
    const yTol = torsoH * 0.08;
    const xMaxS = shoulderW > 0.02 ? shoulderW * 0.55 : 0.08;
    const xMaxH = shoulderW > 0.02 ? shoulderW * 0.60 : 0.09;

    const lAtSide = leftWrist.y > hipCenterY - yTol && Math.abs(leftWrist.x - leftShoulder.x) < xMaxS && Math.abs(leftWrist.x - leftHip.x) < xMaxH;
    const rAtSide = rightWrist.y > hipCenterY - yTol && Math.abs(rightWrist.x - rightShoulder.x) < xMaxS && Math.abs(rightWrist.x - rightHip.x) < xMaxH;

    if (!lAtSide || !rAtSide) {
      const lOff = shoulderW > 0.02 ? Math.abs(leftWrist.x - leftShoulder.x) / shoulderW : 0;
      const rOff = shoulderW > 0.02 ? Math.abs(rightWrist.x - rightShoulder.x) / shoulderW : 0;
      const maxOff = Math.max(lAtSide ? 0 : lOff, rAtSide ? 0 : rOff);
      if (maxOff > 1.0 || (!lAtSide && leftWrist.y < hipCenterY - torsoH * 0.15) || (!rAtSide && rightWrist.y < hipCenterY - torsoH * 0.15)) {
        attentionDeductions += 15; recommendations.push("Arms must hang straight down at your sides");
      } else { attentionDeductions += 10; recommendations.push("Keep arms closer to your body"); }
    } else { feedback.push("✓ Arms straight at sides"); }

    if (rightWrist.y < rightShoulder.y - torsoH * 0.05) {
      attentionDeductions += 20; hardFail = true;
      recommendations.push("For attention, keep right hand down at your side");
    }

    const lArmAng = calculateAngle(leftShoulder, leftElbow, leftWrist);
    const rArmAng = calculateAngle(rightShoulder, rightElbow, rightWrist);
    if (lArmAng < 145 || rArmAng < 145) { attentionDeductions += 10; recommendations.push("Straighten both arms completely"); }
    else if (lArmAng < 160 || rArmAng < 160) { attentionDeductions += 5; recommendations.push("Keep arms straighter along trouser seams"); }
  } else { attentionDeductions += 15; recommendations.push("Ensure both arms and hips are fully visible"); }

  // --- BODY VERTICALITY ---
  if (isVisible(headPoint, 0.35) && isVisible(leftHip, 0.4) && isVisible(rightHip, 0.4)) {
    const hipCX = (leftHip.x + rightHip.x) / 2;
    const hipCY = (leftHip.y + rightHip.y) / 2;
    const bodyLean = Math.abs(headPoint!.x - hipCX);
    const torsoH = Math.max(0.1, Math.abs(hipCY - headPoint!.y));
    const leanR = bodyLean / torsoH;
    if (leanR >= 0.35) { attentionDeductions += 20; hardFail = true; recommendations.push("Body is heavily leaning - stand upright"); }
    else if (leanR >= 0.18) { attentionDeductions += 20; recommendations.push("Stand straight and keep body vertical"); }
    else if (leanR >= 0.10) { attentionDeductions += 10; recommendations.push("Slight body lean detected"); }
    else feedback.push("✓ Body vertical and aligned");
  }

  // --- SYMMETRY ---
  if (isVisible(leftShoulder, 0.35) && isVisible(rightShoulder, 0.35) && isVisible(leftHip, 0.35) && isVisible(rightHip, 0.35)) {
    const symOff = Math.abs((leftShoulder.x + rightShoulder.x) / 2 - (leftHip.x + rightHip.x) / 2);
    if (symOff >= 0.06) { attentionDeductions += 10; recommendations.push("Hips and shoulders should align symmetrically"); }
    else if (symOff >= 0.035) { attentionDeductions += 5; }
    else feedback.push("✓ Body symmetry is good");
  }

  // --- KNEES ---
  if (isVisible(leftHip, 0.35) && isVisible(leftKnee, 0.35) && isVisible(leftAnkle, 0.35) &&
      isVisible(rightHip, 0.35) && isVisible(rightKnee, 0.35) && isVisible(rightAnkle, 0.35)) {
    const lKA = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rKA = calculateAngle(rightHip, rightKnee, rightAnkle);
    if (lKA < 155 || rKA < 155) { attentionDeductions += 10; recommendations.push("Keep both knees straight without stiffness"); }
    else if (lKA < 165 || rKA < 165) { attentionDeductions += 5; recommendations.push("Straighten knees for position of attention"); }
    else feedback.push("✓ Knees straight");
  }

  // --- FEET ---
  if (isVisible(leftAnkle, 0.35) && isVisible(rightAnkle, 0.35)) {
    const fSpacing = Math.abs(leftAnkle.x - rightAnkle.x);
    let hipW = 0;
    if (isVisible(leftHip, 0.35) && isVisible(rightHip, 0.35)) hipW = Math.abs(leftHip.x - rightHip.x);

    if (hipW > 0.01) {
      const fR = fSpacing / hipW;
      if (fR > 1.1) { attentionDeductions += 15; hardFail = true; recommendations.push("Feet are too far apart - bring heels together"); }
      else if (fR > 0.80) { attentionDeductions += 12; recommendations.push("Bring your heels closer together"); }
      else if (fR > 0.60) { attentionDeductions += 5; recommendations.push("Heels should be closer for attention position"); }
      else feedback.push("✓ Feet position correct");
    } else {
      if (fSpacing > 0.12) { attentionDeductions += 15; hardFail = true; recommendations.push("Feet are too far apart"); }
      else if (fSpacing > 0.07) { attentionDeductions += 10; recommendations.push("Bring heels closer"); }
      else feedback.push("✓ Feet position correct");
    }
  }

  if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) feedback.push("✓ Full body clearly visible");

  score = Math.max(0, 100 - attentionDeductions);
  if (hardFail) scoreCap = Math.min(scoreCap, 25);
  if (!armSignatureReliable) scoreCap = Math.min(scoreCap, 50);

  const perfectCriticalChecksPassed = attentionDeductions === 0 && armSignatureReliable && !hardFail && scoreCap === 100;

  return { score, scoreCap, feedback, recommendations, perfectCriticalChecksPassed };
}
