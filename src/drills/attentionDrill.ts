/**
 * Attention Drill Evaluator — Real-time Deduction Engine
 *
 * Methodology Note (Chapter 3):
 * Evaluates Position of Attention per PA Manual 8-0107 Section 3.
 * Includes head rotation/tilt detection via raw MoveNet ear/eye keypoints.
 *
 * Checks: head position+rotation+tilt, shoulders, arms at sides,
 * elbow straightness, body verticality, symmetry, knees, feet.
 */

import type {
  CustomKeypoint, IdealPoint, RawMoveNetKeypoint,
  PostureScoreResult, BodyPartCorrection, CorrectionSeverity,
} from "./types";
import { KP } from "./types";
import { jointAngle } from "../utils/angleUtils";
import {
  computeDistanceScore, applyVisibilityGate, detectSideView,
  blendScores, clampScore,
} from "../utils/scoringUtils";

export function evaluateAttention(
  customKeypoints: CustomKeypoint[],
  ideal: IdealPoint[],
  rawMoveNetKeypoints?: RawMoveNetKeypoint[],
): PostureScoreResult {
  const corrections: BodyPartCorrection[] = [];
  const errorKpIdx: number[] = [];
  const warningKpIdx: number[] = [];

  if (customKeypoints.length === 0 || ideal.length === 0) {
    return { score: 0, passed: false, corrections: [], errorKeypointIndices: [], warningKeypointIndices: [] };
  }

  const { score: distanceScore, validPoints } = computeDistanceScore(customKeypoints, ideal);
  if (validPoints === 0) {
    return { score: 0, passed: false, corrections: [], errorKeypointIndices: [], warningKeypointIndices: [] };
  }

  const visThr = 0.3;
  const visCount = customKeypoints.filter(p => p.confidence > visThr).length;
  let scoreCap = applyVisibilityGate(visCount, 100);
  const isSideView = detectSideView(customKeypoints);

  const kp = (i: number) => customKeypoints[i];
  const vis = (i: number, min = visThr) => { const p = kp(i); return Boolean(p && p.confidence > min); };

  let ded = 0;
  let hardFail = false;

  const reqVis = vis(KP.LEFT_HAND) && vis(KP.RIGHT_HAND) && vis(KP.HIPS_CENTER) && vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER);
  if (!reqVis) scoreCap = Math.min(scoreCap, 40);

  // --- HEAD (position + rotation + tilt) ---
  if (vis(KP.HEAD) && vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const hd = kp(KP.HEAD);
    const scX = (kp(KP.LEFT_SHOULDER).x + kp(KP.RIGHT_SHOULDER).x) / 2;
    const headOff = Math.abs(hd.x - scX);
    let headDed = 0;
    let headSev: CorrectionSeverity = "good";
    let headMsg = "Head position correct";

    if (headOff >= 0.10) { headDed = 20; headSev = "fail"; headMsg = "Face straight forward"; hardFail = true; }
    else if (headOff >= 0.06) { headDed = 20; headSev = "error"; headMsg = "Keep your head level and centered"; }
    else if (headOff >= 0.04) { headDed = 10; headSev = "warning"; headMsg = "Align your head to the center"; }

    // Head rotation via raw MoveNet ear/eye
    if (rawMoveNetKeypoints && rawMoveNetKeypoints.length >= 5) {
      const rawLEye = rawMoveNetKeypoints[1], rawREye = rawMoveNetKeypoints[2];
      const rawLEar = rawMoveNetKeypoints[3], rawREar = rawMoveNetKeypoints[4];
      const lEyeC = rawLEye?.score ?? 0, rEyeC = rawREye?.score ?? 0;
      const lEarC = rawLEar?.score ?? 0, rEarC = rawREar?.score ?? 0;

      const earCD = Math.abs(lEarC - rEarC);
      const minEarC = Math.min(lEarC, rEarC);
      const earAsym = (lEarC > 0.15 || rEarC > 0.15) && (earCD > 0.35 || minEarC < 0.15);
      const eyeCD = Math.abs(lEyeC - rEyeC);
      const eyeAsym = (lEyeC > 0.2 || rEyeC > 0.2) && eyeCD > 0.3;

      let headTilted = false;
      if (lEyeC > 0.3 && rEyeC > 0.3 && rawLEye && rawREye) {
        const eyeYD = Math.abs(rawLEye.y - rawREye.y);
        const eyeXS = Math.abs(rawLEye.x - rawREye.x);
        if (eyeXS > 0 && eyeYD / eyeXS > 0.35) headTilted = true;
      }

      const headRotated = earAsym || eyeAsym;
      const headStronglyRotated = earAsym && eyeAsym;

      if (headStronglyRotated && headDed < 20) { headDed = 20; headSev = "error"; headMsg = "Face straight forward"; }
      else if (headRotated && headDed < 15) { headDed = 15; headSev = headSev === "good" ? "warning" : headSev; headMsg = "Keep your head level"; }
      if (headTilted && headDed < 10) { headDed = Math.max(headDed, 10); headSev = headSev === "good" ? "warning" : headSev; headMsg = "Keep your head level"; }
    }

    ded += headDed;
    corrections.push({ bodyPart: "Head", icon: "🧠", status: headSev, suggestion: headMsg, deduction: headDed });
    if (headSev === "fail" || headSev === "error") errorKpIdx.push(KP.HEAD);
    else if (headSev === "warning") warningKpIdx.push(KP.HEAD);

    if (vis(KP.HIPS_CENTER) && Math.abs(hd.x - kp(KP.HIPS_CENTER).x) >= 0.09) ded += 5;
  }

  // --- SHOULDERS ---
  if (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const sDiff = Math.abs(kp(KP.LEFT_SHOULDER).y - kp(KP.RIGHT_SHOULDER).y);
    if (sDiff >= 0.06) {
      ded += 15;
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "error", suggestion: "Level both shoulders", deduction: 15 });
      errorKpIdx.push(KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER);
    } else if (sDiff >= 0.035) {
      ded += 8;
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "warning", suggestion: "Keep shoulders balanced", deduction: 8 });
      warningKpIdx.push(KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER);
    } else {
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "good", suggestion: "Shoulders level", deduction: 0 });
    }
  }

  // --- ARMS ---
  if (reqVis) {
    const lH = kp(KP.LEFT_HAND), rH = kp(KP.RIGHT_HAND), hp = kp(KP.HIPS_CENTER);
    const lSide = lH.y > hp.y - 0.04 && Math.abs(lH.x - kp(KP.LEFT_SHOULDER).x) < 0.12;
    const rSide = rH.y > hp.y - 0.04 && Math.abs(rH.x - kp(KP.RIGHT_SHOULDER).x) < 0.12;
    if (!lSide || !rSide) {
      ded += 10;
      corrections.push({ bodyPart: "Arms", icon: "🤲", status: "error", suggestion: "Keep arms straight at your sides", deduction: 10 });
      if (!lSide) errorKpIdx.push(KP.LEFT_HAND, KP.LEFT_ELBOW);
      if (!rSide) errorKpIdx.push(KP.RIGHT_HAND, KP.RIGHT_ELBOW);
    } else {
      corrections.push({ bodyPart: "Arms", icon: "🤲", status: "good", suggestion: "Arms at sides", deduction: 0 });
    }
    // Salute rejection
    if (rH.y < kp(KP.RIGHT_SHOULDER).y - 0.03) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Right Hand", icon: "✋", status: "fail", suggestion: "Place hands closer to thighs", deduction: 20 });
      errorKpIdx.push(KP.RIGHT_HAND, KP.RIGHT_ELBOW);
    }
    // Elbow straightness
    if (vis(KP.LEFT_ELBOW) && vis(KP.RIGHT_ELBOW)) {
      const lA = jointAngle(kp(KP.LEFT_SHOULDER), kp(KP.LEFT_ELBOW), lH);
      const rA = jointAngle(kp(KP.RIGHT_SHOULDER), kp(KP.RIGHT_ELBOW), rH);
      if (lA < 145 || rA < 145) {
        ded += 10;
        corrections.push({ bodyPart: "Elbows", icon: "💪", status: "error", suggestion: "Relax and align your arms", deduction: 10 });
        if (lA < 145) errorKpIdx.push(KP.LEFT_ELBOW);
        if (rA < 145) errorKpIdx.push(KP.RIGHT_ELBOW);
      } else if (lA < 160 || rA < 160) {
        ded += 5;
        corrections.push({ bodyPart: "Elbows", icon: "💪", status: "warning", suggestion: "Straighten arms fully", deduction: 5 });
        if (lA < 160) warningKpIdx.push(KP.LEFT_ELBOW);
        if (rA < 160) warningKpIdx.push(KP.RIGHT_ELBOW);
      }
    }
  } else {
    ded += 15;
  }

  // --- BODY VERTICALITY ---
  if (vis(KP.HEAD) && vis(KP.HIPS_CENTER)) {
    const hd = kp(KP.HEAD), hp = kp(KP.HIPS_CENTER);
    const lR = Math.abs(hd.x - hp.x) / Math.max(0.1, Math.abs(hp.y - hd.y));
    if (lR >= 0.35) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "fail", suggestion: "Stand upright", deduction: 20 });
      errorKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else if (lR >= 0.18) {
      ded += 20;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "error", suggestion: "Keep your torso vertical", deduction: 20 });
      errorKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else if (lR >= 0.1) {
      ded += 10;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "warning", suggestion: "Avoid leaning to one side", deduction: 10 });
      warningKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else {
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "good", suggestion: "Torso vertical", deduction: 0 });
    }
  }

  // --- SYMMETRY ---
  if (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER) && vis(KP.LEFT_HIP) && vis(KP.RIGHT_HIP)) {
    const symOff = Math.abs((kp(KP.LEFT_SHOULDER).x + kp(KP.RIGHT_SHOULDER).x) / 2 - (kp(KP.LEFT_HIP).x + kp(KP.RIGHT_HIP).x) / 2);
    if (symOff >= 0.06) ded += 10;
    else if (symOff >= 0.035) ded += 5;
  }

  // --- KNEES ---
  if (vis(KP.LEFT_HIP) && vis(KP.LEFT_KNEE) && vis(KP.LEFT_ANKLE) && vis(KP.RIGHT_HIP) && vis(KP.RIGHT_KNEE) && vis(KP.RIGHT_ANKLE)) {
    const lK = jointAngle(kp(KP.LEFT_HIP), kp(KP.LEFT_KNEE), kp(KP.LEFT_ANKLE));
    const rK = jointAngle(kp(KP.RIGHT_HIP), kp(KP.RIGHT_KNEE), kp(KP.RIGHT_ANKLE));
    if (lK < 155 || rK < 155) {
      ded += 10;
      corrections.push({ bodyPart: "Knees", icon: "🦵", status: "error", suggestion: "Straighten your knees", deduction: 10 });
      if (lK < 155) errorKpIdx.push(KP.LEFT_KNEE);
      if (rK < 155) errorKpIdx.push(KP.RIGHT_KNEE);
    } else if (lK < 165 || rK < 165) {
      ded += 5;
      corrections.push({ bodyPart: "Knees", icon: "🦵", status: "warning", suggestion: "Lock knees naturally without stiffness", deduction: 5 });
      if (lK < 165) warningKpIdx.push(KP.LEFT_KNEE);
      if (rK < 165) warningKpIdx.push(KP.RIGHT_KNEE);
    } else {
      corrections.push({ bodyPart: "Knees", icon: "🦵", status: "good", suggestion: "Knees straight", deduction: 0 });
    }
  }

  // --- FEET ---
  if (vis(KP.LEFT_ANKLE) && vis(KP.RIGHT_ANKLE)) {
    const fSpacing = Math.abs(kp(KP.LEFT_ANKLE).x - kp(KP.RIGHT_ANKLE).x);
    let hipW = 0;
    if (vis(KP.LEFT_HIP) && vis(KP.RIGHT_HIP)) hipW = Math.abs(kp(KP.LEFT_HIP).x - kp(KP.RIGHT_HIP).x);

    if (hipW > 0.01) {
      const fR = fSpacing / hipW;
      if (fR > 1.1) {
        ded += 15; hardFail = true;
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "fail", suggestion: "Feet are too far apart - bring heels together", deduction: 15 });
        errorKpIdx.push(KP.LEFT_ANKLE, KP.RIGHT_ANKLE);
      } else if (fR > 0.80) {
        ded += 12;
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "error", suggestion: "Bring your heels closer together", deduction: 12 });
        errorKpIdx.push(KP.LEFT_ANKLE, KP.RIGHT_ANKLE);
      } else if (fR > 0.60) {
        ded += 5;
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "warning", suggestion: "Heels should be closer for attention position", deduction: 5 });
        warningKpIdx.push(KP.LEFT_ANKLE, KP.RIGHT_ANKLE);
      } else {
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "good", suggestion: "Feet position correct", deduction: 0 });
      }
    } else {
      if (fSpacing > 0.12) {
        ded += 15; hardFail = true;
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "fail", suggestion: "Feet are too far apart - bring heels together", deduction: 15 });
        errorKpIdx.push(KP.LEFT_ANKLE, KP.RIGHT_ANKLE);
      } else if (fSpacing > 0.07) {
        ded += 10;
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "warning", suggestion: "Bring heels closer for proper attention position", deduction: 10 });
        warningKpIdx.push(KP.LEFT_ANKLE, KP.RIGHT_ANKLE);
      } else {
        corrections.push({ bodyPart: "Feet", icon: "👟", status: "good", suggestion: "Feet position correct", deduction: 0 });
      }
    }
  }

  const ruleScore = Math.max(0, 100 - ded);
  if (hardFail) scoreCap = Math.min(scoreCap, 25);
  if (!reqVis) scoreCap = Math.min(scoreCap, 40);

  let finalScore = blendScores(distanceScore, ruleScore, "attention", isSideView);
  finalScore = clampScore(finalScore, scoreCap);

  return { score: finalScore, passed: finalScore >= 75, corrections, errorKeypointIndices: errorKpIdx, warningKeypointIndices: warningKpIdx };
}
