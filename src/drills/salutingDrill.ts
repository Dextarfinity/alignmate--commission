/**
 * Saluting Drill Evaluator — Real-time Deduction Engine
 *
 * Methodology Note (Chapter 3):
 * Evaluates the Hand Salute per PA Manual 8-0107 Section 4.
 * Deduction-based: starts at 100, subtracts for each violation.
 *
 * Checks: hand-to-head, elbow, forearm angle, head alignment,
 * shoulders, body verticality, left arm, two-hand rejection,
 * attention-stance rejection.
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

export function evaluateSalutation(
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

  const reqVis = vis(KP.RIGHT_HAND) && vis(KP.RIGHT_SHOULDER) && vis(KP.HEAD) && vis(KP.RIGHT_ELBOW);
  if (!reqVis) scoreCap = Math.min(scoreCap, 40);

  const sW = (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER))
    ? Math.abs(kp(KP.LEFT_SHOULDER).x - kp(KP.RIGHT_SHOULDER).x) : 0;
  const tH = (vis(KP.HEAD) && vis(KP.HIPS_CENTER))
    ? Math.max(0.05, Math.abs(kp(KP.HIPS_CENTER).y - kp(KP.HEAD).y)) : 0.25;

  // --- HAND-TO-HEAD ---
  if (vis(KP.RIGHT_HAND) && vis(KP.HEAD) && vis(KP.RIGHT_SHOULDER)) {
    const rH = kp(KP.RIGHT_HAND), hd = kp(KP.HEAD), rS = kp(KP.RIGHT_SHOULDER);
    const raised = rH.y < rS.y;
    const refX = hd.x + (rS.x - hd.x) * 0.25;
    const dist = Math.sqrt((rH.x - refX) ** 2 + (rH.y - hd.y) ** 2);
    const ratio = dist / tH;
    const aboveHead = rH.y < hd.y - tH * 0.20;
    const belowFH = rH.y > hd.y + tH * 0.20;
    const onTop = rH.y < hd.y - tH * 0.10 && Math.abs(rH.x - hd.x) < (sW > 0.02 ? sW * 0.3 : 0.04);

    if (!raised) {
      ded += 25; hardFail = true;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "fail", suggestion: "Raise right hand to forehead", deduction: 25 });
      errorKpIdx.push(KP.RIGHT_HAND);
    } else if (onTop) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "fail", suggestion: "Hand is on top of head - bring to right eyebrow", deduction: 20 });
      errorKpIdx.push(KP.RIGHT_HAND);
    } else if (ratio > 0.55) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "fail", suggestion: "Hand is too far from forehead", deduction: 20 });
      errorKpIdx.push(KP.RIGHT_HAND);
    } else if (aboveHead) {
      ded += 15;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "error", suggestion: "Hand is too high - align near right eyebrow", deduction: 15 });
      errorKpIdx.push(KP.RIGHT_HAND);
    } else if (belowFH) {
      ded += 15;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "error", suggestion: "Raise right hand higher toward forehead", deduction: 15 });
      errorKpIdx.push(KP.RIGHT_HAND);
    } else if (ratio > 0.35) {
      ded += 8;
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "warning", suggestion: "Align forefinger near right eyebrow", deduction: 8 });
      warningKpIdx.push(KP.RIGHT_HAND);
    } else {
      corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "good", suggestion: "Hand at forehead - correct", deduction: 0 });
    }

    // Attention-like detection
    const rHip = vis(KP.RIGHT_HIP) ? kp(KP.RIGHT_HIP) : kp(KP.HIPS_CENTER);
    if (rH.y > rHip.y - tH * 0.05 && (sW > 0.02 ? Math.abs(rH.x - rHip.x) < sW * 0.5 : Math.abs(rH.x - rHip.x) < 0.10)) {
      scoreCap = Math.min(scoreCap, 20);
    }
  } else {
    ded += 25; hardFail = true;
    corrections.push({ bodyPart: "Salute Hand", icon: "🖐️", status: "fail", suggestion: "Right hand not detected - raise hand to forehead", deduction: 25 });
  }

  // --- ELBOW ---
  if (vis(KP.RIGHT_ELBOW) && vis(KP.RIGHT_SHOULDER) && vis(KP.RIGHT_HAND)) {
    const rE = kp(KP.RIGHT_ELBOW), rS = kp(KP.RIGHT_SHOULDER), rH = kp(KP.RIGHT_HAND);
    const dropR = (rE.y - rS.y) / tH;
    const fAngle = jointAngle(rS, rE, rH);
    if (dropR > 0.25) {
      ded += 15; hardFail = true;
      corrections.push({ bodyPart: "Elbow", icon: "💪", status: "fail", suggestion: "Raise your right elbow higher", deduction: 15 });
      errorKpIdx.push(KP.RIGHT_ELBOW);
    } else if (dropR > 0.12) {
      ded += 10;
      corrections.push({ bodyPart: "Elbow", icon: "💪", status: "error", suggestion: "Keep elbow slightly forward and up", deduction: 10 });
      errorKpIdx.push(KP.RIGHT_ELBOW);
    } else {
      corrections.push({ bodyPart: "Elbow", icon: "💪", status: "good", suggestion: "Elbow position correct", deduction: 0 });
    }
    if (fAngle < 20 || fAngle > 100) {
      ded += 10;
      corrections.push({ bodyPart: "Forearm", icon: "📐", status: "error", suggestion: "Adjust forearm angle - aim for ~45°", deduction: 10 });
    }
  }

  // --- HEAD ---
  if (vis(KP.HEAD) && vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const hd = kp(KP.HEAD);
    const scX = (kp(KP.LEFT_SHOULDER).x + kp(KP.RIGHT_SHOULDER).x) / 2;
    const hOff = Math.abs(hd.x - scX);
    const hOffR = sW > 0.02 ? hOff / sW : hOff / 0.10;
    if (hOffR > 0.45) {
      ded += 10;
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "error", suggestion: "Face straight forward while saluting", deduction: 10 });
      errorKpIdx.push(KP.HEAD);
    } else if (hOffR > 0.25) {
      ded += 5;
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "warning", suggestion: "Keep head centered", deduction: 5 });
    } else {
      corrections.push({ bodyPart: "Head", icon: "🧠", status: "good", suggestion: "Head position correct", deduction: 0 });
    }
  }

  // --- SHOULDERS ---
  if (vis(KP.LEFT_SHOULDER) && vis(KP.RIGHT_SHOULDER)) {
    const sDiff = Math.abs(kp(KP.LEFT_SHOULDER).y - kp(KP.RIGHT_SHOULDER).y);
    const sDiffR = tH > 0.05 ? sDiff / tH : sDiff / 0.05;
    if (sDiffR > 0.15) {
      ded += 10;
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "error", suggestion: "Level both shoulders while saluting", deduction: 10 });
      errorKpIdx.push(KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER);
    } else {
      corrections.push({ bodyPart: "Shoulders", icon: "💪", status: "good", suggestion: "Shoulders level", deduction: 0 });
    }
  }

  // --- BODY VERTICALITY ---
  if (vis(KP.HEAD) && vis(KP.HIPS_CENTER)) {
    const hd = kp(KP.HEAD), hp = kp(KP.HIPS_CENTER);
    const lR = Math.abs(hd.x - hp.x) / Math.max(0.05, Math.abs(hp.y - hd.y));
    if (lR >= 0.30) {
      ded += 15; hardFail = true;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "fail", suggestion: "Stand upright while saluting", deduction: 15 });
      errorKpIdx.push(KP.HEAD, KP.HIPS_CENTER);
    } else if (lR >= 0.15) {
      ded += 10;
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "error", suggestion: "Maintain upright posture", deduction: 10 });
    } else {
      corrections.push({ bodyPart: "Body", icon: "🧍", status: "good", suggestion: "Torso upright", deduction: 0 });
    }
  }

  // --- LEFT ARM ---
  if (vis(KP.LEFT_HAND) && vis(KP.LEFT_SHOULDER) && vis(KP.HIPS_CENTER)) {
    const lH = kp(KP.LEFT_HAND), lS = kp(KP.LEFT_SHOULDER), hp = kp(KP.HIPS_CENTER);
    const lXOff = sW > 0.02 ? Math.abs(lH.x - lS.x) / sW : Math.abs(lH.x - lS.x) / 0.10;
    const lDown = lH.y > hp.y - tH * 0.08;
    if (!lDown || lXOff > 0.70) {
      ded += 10;
      corrections.push({ bodyPart: "Left Arm", icon: "🤲", status: "error", suggestion: "Keep left arm straight at your side", deduction: 10 });
      errorKpIdx.push(KP.LEFT_HAND, KP.LEFT_ELBOW);
    } else {
      corrections.push({ bodyPart: "Left Arm", icon: "🤲", status: "good", suggestion: "Left arm at side", deduction: 0 });
    }
  }

  // --- TWO-HAND SALUTE REJECTION ---
  if (vis(KP.LEFT_HAND) && vis(KP.LEFT_SHOULDER) && vis(KP.HEAD)) {
    const lH = kp(KP.LEFT_HAND), lS = kp(KP.LEFT_SHOULDER), hd = kp(KP.HEAD);
    const lRaised = lH.y < lS.y;
    const lNearHead = Math.sqrt((lH.x - hd.x) ** 2 + (lH.y - hd.y) ** 2) / tH < 0.40;
    if (lRaised && lNearHead) {
      ded += 20; hardFail = true;
      corrections.push({ bodyPart: "Wrong Hand", icon: "🚫", status: "fail", suggestion: "Salute with RIGHT hand only", deduction: 20 });
      errorKpIdx.push(KP.LEFT_HAND, KP.LEFT_ELBOW);
    }
  }

  const ruleScore = Math.max(0, 100 - ded);
  if (hardFail) scoreCap = Math.min(scoreCap, 25);
  if (!reqVis) scoreCap = Math.min(scoreCap, 40);

  let finalScore = blendScores(distanceScore, ruleScore, "salutation", isSideView);
  finalScore = clampScore(finalScore, scoreCap);

  return { score: finalScore, passed: finalScore >= 75, corrections, errorKeypointIndices: errorKpIdx, warningKeypointIndices: warningKpIdx };
}
