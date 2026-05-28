/**
 * Marching Drill Evaluator — Real-time Deduction Engine
 *
 * Methodology Note (Chapter 3):
 * Evaluates March in Place per PA Manual 8-0107.
 * Uses body-relative leg lift ratios to determine step quality.
 *
 * Checks: foot lift, knee elevation, body verticality, shoulders,
 * arm discipline, head alignment, hip symmetry.
 */

import type {
  CustomKeypoint, IdealPoint, RawMoveNetKeypoint,
  PostureScoreResult, BodyPartCorrection,
} from "./types";
import { KP } from "./types";
import { jointAngle } from "../utils/angleUtils";
import {
  computeDistanceScore, applyVisibilityGate, detectSideView,
  blendScores, clampScore,
} from "../utils/scoringUtils";

export function evaluateMarching(
  customKeypoints: CustomKeypoint[],
  ideal: IdealPoint[],
  _rawMoveNetKeypoints?: RawMoveNetKeypoint[],
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

  // Body-size references
  const sW = (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER))
    ? Math.abs(kp(KP.LEFT_SHOULDER).x - kp(KP.RIGHT_SHOULDER).x) : 0;
  const tH = (vis(KP.HEAD) && vis(KP.HIPS_CENTER))
    ? Math.max(0.05, Math.abs(kp(KP.HIPS_CENTER).y - kp(KP.HEAD).y)) : 0.25;

  // Leg length proxy
  let legLen = 0.35;
  if (vis(KP.LEFT_HIP) && vis(KP.LEFT_ANKLE)) {
    const lLeg = Math.abs(kp(KP.LEFT_ANKLE).y - kp(KP.LEFT_HIP).y);
    if (vis(KP.RIGHT_HIP) && vis(KP.RIGHT_ANKLE)) {
      legLen = Math.max(0.15, (lLeg + Math.abs(kp(KP.RIGHT_ANKLE).y - kp(KP.RIGHT_HIP).y)) / 2);
    } else { legLen = Math.max(0.15, lLeg); }
  } else if (vis(KP.RIGHT_HIP) && vis(KP.RIGHT_ANKLE)) {
    legLen = Math.max(0.15, Math.abs(kp(KP.RIGHT_ANKLE).y - kp(KP.RIGHT_HIP).y));
  }

  // --- FOOT LIFT ---
  let footLiftOK = false;
  if (vis(KP.LEFT_ANKLE) && vis(KP.RIGHT_ANKLE)) {
    const lAY = kp(KP.LEFT_ANKLE).y, rAY = kp(KP.RIGHT_ANKLE).y;
    const ankleH = Math.abs(lAY - rAY);
    const liftRatio = ankleH / legLen;

    if (liftRatio >= 0.12) {
      footLiftOK = true;
      corrections.push({ bodyPart: "Foot Lift", icon: "🦶", status: "good", suggestion: "Clear foot lift detected", deduction: 0 });
    } else if (liftRatio >= 0.08) {
      footLiftOK = true;
      ded += 5;
      corrections.push({ bodyPart: "Foot Lift", icon: "🦶", status: "warning", suggestion: "Lift your foot a bit higher", deduction: 5 });
      const liftKnee = lAY < rAY ? KP.LEFT_KNEE : KP.RIGHT_KNEE;
      warningKpIdx.push(liftKnee);
    } else if (liftRatio >= 0.04) {
      ded += 12;
      corrections.push({ bodyPart: "Foot Lift", icon: "🦶", status: "error", suggestion: "Increase your step height", deduction: 12 });
      const liftKnee = lAY < rAY ? KP.LEFT_KNEE : KP.RIGHT_KNEE;
      errorKpIdx.push(liftKnee);
    } else {
      ded += 20;
      corrections.push({ bodyPart: "Foot Lift", icon: "🦶", status: "error", suggestion: "No march detected - lift legs alternately", deduction: 20 });
    }

    // Knee bend check on lifted leg
    if (footLiftOK) {
      const liftedLeft = lAY < rAY;
      const hipI = liftedLeft ? KP.LEFT_HIP : KP.RIGHT_HIP;
      const kneeI = liftedLeft ? KP.LEFT_KNEE : KP.RIGHT_KNEE;
      const ankleI = liftedLeft ? KP.LEFT_ANKLE : KP.RIGHT_ANKLE;
      if (vis(hipI) && vis(kneeI) && vis(ankleI)) {
        const kneeAng = jointAngle(kp(hipI), kp(kneeI), kp(ankleI));
        if (kneeAng > 160) {
          ded += 8;
          corrections.push({ bodyPart: "Knee Bend", icon: "🦵", status: "warning", suggestion: "Bend your knee more when marching", deduction: 8 });
          warningKpIdx.push(kneeI);
        } else {
          corrections.push({ bodyPart: "Knee Bend", icon: "🦵", status: "good", suggestion: "Knee bend correct", deduction: 0 });
        }
      }
    }
  } else {
    ded += 20;
    corrections.push({ bodyPart: "Foot Lift", icon: "🦶", status: "error", suggestion: "Ensure legs are fully visible", deduction: 20 });
  }

  // --- BODY VERTICALITY ---
  if (vis(KP.HEAD) && vis(KP.HIPS_CENTER)) {
    const hd = kp(KP.HEAD), hp = kp(KP.HIPS_CENTER);
    const lR = Math.abs(hd.x - hp.x) / Math.max(0.1, Math.abs(hp.y - hd.y));
    if (lR >= 0.30) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "fail", suggestion: "Stand upright while marching", deduction: 20 });
      errorKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else if (lR >= 0.18) {
      ded += 15;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "error", suggestion: "Keep torso vertical during march", deduction: 15 });
      errorKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else if (lR >= 0.10) {
      ded += 8;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "warning", suggestion: "Slight lean detected", deduction: 8 });
      warningKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else {
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "good", suggestion: "Torso upright", deduction: 0 });
    }
  }

  // --- SHOULDERS ---
  if (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const sDiff = Math.abs(kp(KP.LEFT_SHOULDER).y - kp(KP.RIGHT_SHOULDER).y);
    const sDiffR = tH > 0.05 ? sDiff / tH : sDiff / 0.05;
    if (sDiffR > 0.18) {
      ded += 12;
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "error", suggestion: "Keep shoulders level while marching", deduction: 12 });
      errorKpIdx.push(KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER);
    } else if (sDiffR > 0.10) {
      ded += 6;
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "warning", suggestion: "Level your shoulders", deduction: 6 });
      warningKpIdx.push(KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER);
    } else {
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "good", suggestion: "Shoulders level", deduction: 0 });
    }
  }

  // --- ARMS ---
  if (vis(KP.LEFT_HAND) && vis(KP.RIGHT_HAND) && vis(KP.HIPS_CENTER)) {
    const lH = kp(KP.LEFT_HAND), rH = kp(KP.RIGHT_HAND), hp = kp(KP.HIPS_CENTER);
    const lXMax = sW > 0.02 ? sW * 0.60 : 0.09;
    const yTol = tH * 0.10;
    const lSide = lH.y > hp.y - yTol && (vis(KP.LEFT_SHOULDER) ? Math.abs(lH.x - kp(KP.LEFT_SHOULDER).x) < lXMax : true);
    const rSide = rH.y > hp.y - yTol && (vis(KP.RIGHT_SHOULDER) ? Math.abs(rH.x - kp(KP.RIGHT_SHOULDER).x) < lXMax : true);
    if (!lSide || !rSide) {
      ded += 10;
      corrections.push({ bodyPart: "Arms", icon: "🤲", status: "error", suggestion: "Keep arms at your sides while marching", deduction: 10 });
      if (!lSide) errorKpIdx.push(KP.LEFT_HAND, KP.LEFT_ELBOW);
      if (!rSide) errorKpIdx.push(KP.RIGHT_HAND, KP.RIGHT_ELBOW);
    } else {
      corrections.push({ bodyPart: "Arms", icon: "🤲", status: "good", suggestion: "Arms disciplined at sides", deduction: 0 });
    }
  }

  // --- HEAD ---
  if (vis(KP.HEAD) && vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const hd = kp(KP.HEAD);
    const scX = (kp(KP.LEFT_SHOULDER).x + kp(KP.RIGHT_SHOULDER).x) / 2;
    const hOffR = sW > 0.02 ? Math.abs(hd.x - scX) / sW : Math.abs(hd.x - scX) / 0.10;
    if (hOffR > 0.45) {
      ded += 8;
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "error", suggestion: "Keep eyes front during march", deduction: 8 });
      errorKpIdx.push(KP.HEAD);
    } else if (hOffR > 0.25) {
      ded += 4;
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "warning", suggestion: "Center your head", deduction: 4 });
      warningKpIdx.push(KP.HEAD);
    } else {
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "good", suggestion: "Head centered", deduction: 0 });
    }
  }

  // --- HIP SYMMETRY ---
  if (vis(KP.LEFT_HIP) && vis(KP.RIGHT_HIP)) {
    const hipDiffR = tH > 0.05 ? Math.abs(kp(KP.LEFT_HIP).y - kp(KP.RIGHT_HIP).y) / tH : 0;
    if (hipDiffR > 0.20) {
      ded += 8;
      corrections.push({ bodyPart: "Hips", icon: "🫀", status: "error", suggestion: "Keep hips level", deduction: 8 });
    } else if (hipDiffR > 0.12) {
      ded += 4;
      corrections.push({ bodyPart: "Hips", icon: "🫀", status: "warning", suggestion: "Hips are slightly uneven", deduction: 4 });
    }
  }

  if (!footLiftOK) scoreCap = Math.min(scoreCap, 55);
  const ruleScore = Math.max(0, 100 - ded);
  if (hardFail) scoreCap = Math.min(scoreCap, 25);

  let finalScore = blendScores(distanceScore, ruleScore, "marching", isSideView);
  finalScore = clampScore(finalScore, scoreCap);

  return { score: finalScore, passed: finalScore >= 75, corrections, errorKeypointIndices: errorKpIdx, warningKeypointIndices: warningKpIdx };
}
