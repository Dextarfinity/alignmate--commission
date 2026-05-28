/**
 * Template Geometry & Cosine Similarity — Template-Matching Engine
 *
 * Methodology Note (Chapter 3):
 * This module implements the template-matching scoring approach used by
 * the local ONNX pipeline for snapshot-based posture analysis.
 *
 * The approach:
 * 1. Build a compact pose descriptor vector from detected keypoints
 * 2. Compare it against pre-defined template variants using cosine similarity
 * 3. Blend the cosine score with the deduction-based score
 *
 * Template variants account for different camera angles (front, oblique,
 * profile) by morphing the base template with width scaling and x-shift.
 */

import { clampUnit } from "../../utils/angleUtils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name: string;
}

type TemplatePostureType = "attention" | "salutation" | "marching";
type TemplatePoint = { x: number; y: number };
type TemplateKeypoints = Record<string, TemplatePoint>;
export type TemplateVariant = {
  id: string;
  weight: number;
  keypoints: TemplateKeypoints;
};
export type MarchingPhase = "left" | "right" | "none";

export type MarchingGeometryMetrics = {
  hasRequiredKeypoints: boolean;
  phase: MarchingPhase;
  liftQuality: number;
  liftClarity: number;
  riseRunScore: number;
  supportQuality: number;
  verticalRise: number;
  horizontalRun: number;
  k1k2Distance: number;
};

export type MarchingTemporalSample = {
  timestamp: number;
  phase: MarchingPhase;
  liftQuality: number;
};

export type MarchingTemporalSummary = {
  hasEnoughData: boolean;
  durationMs: number;
  alternationScore: number;
  liftScore: number;
  cadenceScore: number;
  temporalScore: number;
};

// ---------------------------------------------------------------------------
// COCO Keypoint Names
// ---------------------------------------------------------------------------

export const KEYPOINT_NAMES = [
  "nose", "left_eye", "right_eye", "left_ear", "right_ear",
  "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
  "left_wrist", "right_wrist", "left_hip", "right_hip",
  "left_knee", "right_knee", "left_ankle", "right_ankle",
];

// ---------------------------------------------------------------------------
// Template Banks
// ---------------------------------------------------------------------------

const clamp = (value: number, min = 0.03, max = 0.97): number =>
  Math.min(max, Math.max(min, value));

const morphTemplateForView = (
  template: TemplateKeypoints,
  options: { widthScale: number; shiftX: number },
): TemplateKeypoints => {
  const { widthScale, shiftX } = options;
  const centerX = 0.5;
  const morphed: TemplateKeypoints = {};
  for (const name of KEYPOINT_NAMES) {
    const point = template[name];
    const deltaX = point.x - centerX;
    morphed[name] = { x: clamp(centerX + deltaX * widthScale + shiftX), y: point.y };
  }
  return morphed;
};

const mirrorTemplateHorizontally = (template: TemplateKeypoints): TemplateKeypoints => {
  const mirrored: TemplateKeypoints = {};
  for (const name of KEYPOINT_NAMES) {
    const point = template[name];
    const mirrorX = clamp(1 - point.x);
    const isLeft = name.startsWith("left_");
    const isRight = name.startsWith("right_");
    const targetName = isLeft ? name.replace("left_", "right_") : isRight ? name.replace("right_", "left_") : name;
    mirrored[targetName] = { x: mirrorX, y: point.y };
  }
  return mirrored;
};

// --- Base Templates ---
const BASE_TEMPLATE_KEYPOINTS: Record<Exclude<TemplatePostureType, "marching">, TemplateKeypoints> = {
  attention: {
    nose: { x: 0.5, y: 0.14 }, left_eye: { x: 0.485, y: 0.13 }, right_eye: { x: 0.515, y: 0.13 },
    left_ear: { x: 0.465, y: 0.14 }, right_ear: { x: 0.535, y: 0.14 },
    left_shoulder: { x: 0.43, y: 0.21 }, right_shoulder: { x: 0.57, y: 0.21 },
    left_elbow: { x: 0.43, y: 0.33 }, right_elbow: { x: 0.57, y: 0.33 },
    left_wrist: { x: 0.43, y: 0.46 }, right_wrist: { x: 0.57, y: 0.46 },
    left_hip: { x: 0.46, y: 0.46 }, right_hip: { x: 0.54, y: 0.46 },
    left_knee: { x: 0.47, y: 0.66 }, right_knee: { x: 0.53, y: 0.66 },
    left_ankle: { x: 0.48, y: 0.87 }, right_ankle: { x: 0.52, y: 0.87 },
  },
  salutation: {
    nose: { x: 0.5, y: 0.14 }, left_eye: { x: 0.485, y: 0.13 }, right_eye: { x: 0.515, y: 0.13 },
    left_ear: { x: 0.465, y: 0.14 }, right_ear: { x: 0.535, y: 0.14 },
    left_shoulder: { x: 0.43, y: 0.21 }, right_shoulder: { x: 0.57, y: 0.21 },
    left_elbow: { x: 0.43, y: 0.33 }, right_elbow: { x: 0.66, y: 0.21 },
    left_wrist: { x: 0.43, y: 0.46 }, right_wrist: { x: 0.585, y: 0.145 },
    left_hip: { x: 0.46, y: 0.46 }, right_hip: { x: 0.54, y: 0.46 },
    left_knee: { x: 0.47, y: 0.66 }, right_knee: { x: 0.53, y: 0.66 },
    left_ankle: { x: 0.48, y: 0.87 }, right_ankle: { x: 0.52, y: 0.87 },
  },
};

// --- Attention Variants ---
const ATTENTION_TEMPLATE_VARIANTS: TemplateVariant[] = (() => {
  const base = BASE_TEMPLATE_KEYPOINTS.attention;
  const variants = [
    { id: "front_strict", weight: 1.0, widthScale: 1.0, shiftX: 0.0 },
    { id: "front_narrow", weight: 0.95, widthScale: 0.9, shiftX: 0.0 },
    { id: "front_wide", weight: 0.9, widthScale: 1.1, shiftX: 0.0 },
    { id: "left_oblique", weight: 0.86, widthScale: 0.78, shiftX: -0.02 },
    { id: "right_oblique", weight: 0.86, widthScale: 0.78, shiftX: 0.02 },
    { id: "left_profile", weight: 0.72, widthScale: 0.58, shiftX: -0.032 },
    { id: "right_profile", weight: 0.72, widthScale: 0.58, shiftX: 0.032 },
  ];
  return variants.map(v => ({ id: v.id, weight: v.weight, keypoints: morphTemplateForView(base, { widthScale: v.widthScale, shiftX: v.shiftX }) }));
})();

// --- Marching Variants ---
const MARCHING_LEFT_BASE: TemplateKeypoints = {
  nose: { x: 0.5, y: 0.14 }, left_eye: { x: 0.485, y: 0.13 }, right_eye: { x: 0.515, y: 0.13 },
  left_ear: { x: 0.465, y: 0.14 }, right_ear: { x: 0.535, y: 0.14 },
  left_shoulder: { x: 0.43, y: 0.21 }, right_shoulder: { x: 0.57, y: 0.21 },
  left_elbow: { x: 0.43, y: 0.33 }, right_elbow: { x: 0.57, y: 0.33 },
  left_wrist: { x: 0.43, y: 0.46 }, right_wrist: { x: 0.57, y: 0.46 },
  left_hip: { x: 0.46, y: 0.46 }, right_hip: { x: 0.54, y: 0.46 },
  left_knee: { x: 0.47, y: 0.58 }, right_knee: { x: 0.53, y: 0.66 },
  left_ankle: { x: 0.47, y: 0.7 }, right_ankle: { x: 0.53, y: 0.87 },
};
const MARCHING_RIGHT_BASE = mirrorTemplateHorizontally(MARCHING_LEFT_BASE);

const buildMarchingPhaseVariants = (phaseId: string, base: TemplateKeypoints): TemplateVariant[] => {
  const variants = [
    { id: `${phaseId}_front_strict`, weight: 1.0, widthScale: 1.0, shiftX: 0.0 },
    { id: `${phaseId}_front_soft`, weight: 0.95, widthScale: 0.92, shiftX: 0.0 },
    { id: `${phaseId}_left_oblique`, weight: 0.86, widthScale: 0.8, shiftX: -0.02 },
    { id: `${phaseId}_right_oblique`, weight: 0.86, widthScale: 0.8, shiftX: 0.02 },
    { id: `${phaseId}_left_profile`, weight: 0.7, widthScale: 0.6, shiftX: -0.03 },
    { id: `${phaseId}_right_profile`, weight: 0.7, widthScale: 0.6, shiftX: 0.03 },
  ];
  return variants.map(v => ({ id: v.id, weight: v.weight, keypoints: morphTemplateForView(base, { widthScale: v.widthScale, shiftX: v.shiftX }) }));
};

export const TEMPLATE_KEYPOINT_BANK: Record<TemplatePostureType, TemplateVariant[]> = {
  attention: ATTENTION_TEMPLATE_VARIANTS,
  salutation: [{ id: "salutation_front", weight: 1, keypoints: BASE_TEMPLATE_KEYPOINTS.salutation }],
  marching: [
    ...buildMarchingPhaseVariants("left_raise", MARCHING_LEFT_BASE),
    ...buildMarchingPhaseVariants("right_raise", MARCHING_RIGHT_BASE),
  ],
};

// ---------------------------------------------------------------------------
// Pose Descriptor & Cosine Similarity
// ---------------------------------------------------------------------------

export function buildPoseDescriptorVector(keypoints: PoseKeypoint[]): number[] | null {
  const kpByName = new Map(keypoints.map(kp => [kp.name, kp]));
  const get = (name: string, min = 0.25): PoseKeypoint | null => {
    const kp = kpByName.get(name);
    return kp && kp.confidence >= min ? kp : null;
  };

  const lS = get("left_shoulder"), rS = get("right_shoulder");
  const lE = get("left_elbow"), rE = get("right_elbow");
  const lW = get("left_wrist"), rW = get("right_wrist");
  const lH = get("left_hip"), rH = get("right_hip");
  const lK = get("left_knee"), rK = get("right_knee");
  const lA = get("left_ankle"), rA = get("right_ankle");

  if (!lS || !rS || !lE || !rE || !lW || !rW || !lH || !rH || !lK || !rK || !lA || !rA) return null;

  const headCandidates = [get("nose"), get("left_eye"), get("right_eye"), get("left_ear"), get("right_ear")].filter((kp): kp is PoseKeypoint => Boolean(kp));
  const sC = { x: (lS.x + rS.x) / 2, y: (lS.y + rS.y) / 2 };
  const hC = { x: (lH.x + rH.x) / 2, y: (lH.y + rH.y) / 2 };
  const head = headCandidates.length
    ? { x: headCandidates.reduce((s, k) => s + k.x, 0) / headCandidates.length, y: headCandidates.reduce((s, k) => s + k.y, 0) / headCandidates.length }
    : { x: sC.x, y: sC.y - 0.12 };

  const safeNorm = (dx: number, dy: number): [number, number] => {
    const len = Math.hypot(dx, dy);
    return len < 1e-6 ? [0, 0] : [dx / len, dy / len];
  };
  const seg = (a: { x: number; y: number }, b: { x: number; y: number }): [number, number] => safeNorm(b.x - a.x, b.y - a.y);

  const tLen = Math.max(0.05, Math.hypot(hC.x - sC.x, hC.y - sC.y));
  const sWidth = Math.max(0.03, Math.hypot(rS.x - lS.x, rS.y - lS.y));

  const d: number[] = [];
  d.push(...seg(sC, hC), ...seg(lS, rS));
  d.push(...seg(lS, lE), ...seg(lE, lW));
  d.push(...seg(rS, rE), ...seg(rE, rW));
  d.push(...seg(lH, lK), ...seg(lK, lA));
  d.push(...seg(rH, rK), ...seg(rK, rA));
  d.push((rW.x - head.x) / tLen, (rW.y - head.y) / tLen);
  d.push((lW.x - lH.x) / tLen, (lW.y - lH.y) / tLen);
  d.push((rW.x - rH.x) / tLen, (rW.y - rH.y) / tLen);
  d.push(Math.abs(lA.x - rA.x) / sWidth);
  return d;
}

export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (!a.length || !b.length || a.length !== b.length) return null;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
  if (magA < 1e-12 || magB < 1e-12) return null;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function getTemplateDescriptorVectors(
  postureType: TemplatePostureType,
): Array<{ id: string; weight: number; descriptor: number[] }> {
  const variants = TEMPLATE_KEYPOINT_BANK[postureType];
  return variants
    .map(variant => {
      const tKps: PoseKeypoint[] = KEYPOINT_NAMES.map(name => {
        const point = variant.keypoints[name];
        return { x: point.x, y: point.y, confidence: 1, name };
      });
      const descriptor = buildPoseDescriptorVector(tKps);
      return descriptor ? { id: variant.id, weight: variant.weight, descriptor } : null;
    })
    .filter((item): item is { id: string; weight: number; descriptor: number[] } => Boolean(item));
}

// ---------------------------------------------------------------------------
// Marching Geometry Evaluation
// ---------------------------------------------------------------------------

export function evaluateMarchingGeometry(keypoints: PoseKeypoint[], minConf = 0.35): MarchingGeometryMetrics {
  const isVis = (kp: PoseKeypoint | undefined): kp is PoseKeypoint => Boolean(kp && kp.confidence >= minConf);
  const kpByName = new Map(keypoints.map(kp => [kp.name, kp]));
  const get = (name: string) => kpByName.get(name);

  const lH = get("left_hip"), rH = get("right_hip");
  const lK = get("left_knee"), rK = get("right_knee");
  const lA = get("left_ankle"), rA = get("right_ankle");

  const noData: MarchingGeometryMetrics = { hasRequiredKeypoints: false, phase: "none", liftQuality: 0, liftClarity: 0, riseRunScore: 0, supportQuality: 0, verticalRise: 0, horizontalRun: 0, k1k2Distance: 0 };
  if (!isVis(lH) || !isVis(rH) || !isVis(lK) || !isVis(rK) || !isVis(lA) || !isVis(rA)) return noData;

  const legLen = Math.max(0.12, ((Math.abs(lA.y - lH.y) + Math.abs(rA.y - rH.y)) / 2));
  const ankleYDiff = lA.y - rA.y;
  const kneeYDiff = lK.y - rK.y;
  const minLiftSignal = legLen * 0.03;

  let phase: MarchingPhase = "none";
  if (Math.abs(ankleYDiff) > minLiftSignal || Math.abs(kneeYDiff) > minLiftSignal) {
    phase = (ankleYDiff > minLiftSignal || kneeYDiff > minLiftSignal) ? "left" : "right";
  }

  if (phase === "none") return { ...noData, hasRequiredKeypoints: true };

  const raisedKnee = phase === "left" ? lK : rK;
  const supportKnee = phase === "left" ? rK : lK;
  const raisedHip = phase === "left" ? lH : rH;
  const supportHip = phase === "left" ? rH : lH;
  const supportAnkle = phase === "left" ? rA : lA;

  const vertRise = Math.max(0, supportKnee.y - raisedKnee.y);
  const horzRun = Math.abs(raisedKnee.x - raisedHip.x);
  const k1k2Dist = Math.hypot(raisedKnee.x - supportKnee.x, raisedKnee.y - supportKnee.y);
  const liftQuality = clampUnit(vertRise / (legLen * 0.22));
  const liftClarity = k1k2Dist > 0.01 ? clampUnit(vertRise / k1k2Dist) : 0;
  const riseRunScore = horzRun > 0.005 ? clampUnit(vertRise / (horzRun + vertRise)) : vertRise > 0.01 ? 1.0 : 0;

  const supportAngle = (() => {
    const dx = supportAnkle.x - supportHip.x;
    const dy = supportAnkle.y - supportHip.y;
    return Math.abs(Math.atan2(dx, dy) * (180 / Math.PI));
  })();
  const supportQuality = clampUnit(1 - supportAngle / 18);

  return { hasRequiredKeypoints: true, phase, liftQuality, liftClarity, riseRunScore, supportQuality, verticalRise: vertRise, horizontalRun: horzRun, k1k2Distance: k1k2Dist };
}

// ---------------------------------------------------------------------------
// Cosine Template Blending
// ---------------------------------------------------------------------------

export function blendWithCosineTemplateScore(
  keypoints: PoseKeypoint[],
  postureType: "salutation" | "marching" | "attention",
  baseScore: number,
  avgConfidence: number,
): { score: number; cosineScore: number | null } {
  const currentDescriptor = buildPoseDescriptorVector(keypoints);
  if (!currentDescriptor) return { score: baseScore, cosineScore: null };

  let templateDescriptors = getTemplateDescriptorVectors(postureType);

  if (postureType === "marching") {
    const phase = evaluateMarchingGeometry(keypoints, 0.35).phase;
    if (phase === "left" || phase === "right") {
      const phasePrefix = `${phase}_raise_`;
      const phaseTemplates = templateDescriptors.filter(t => t.id.startsWith(phasePrefix));
      if (phaseTemplates.length > 0) templateDescriptors = phaseTemplates;
    }
  }

  if (templateDescriptors.length === 0) return { score: baseScore, cosineScore: null };

  const matches = templateDescriptors
    .map(t => { const c = cosineSimilarity(currentDescriptor, t.descriptor); return c !== null ? { cosine: c, weightedCosine: c * t.weight } : null; })
    .filter((item): item is { cosine: number; weightedCosine: number } => Boolean(item))
    .sort((a, b) => b.weightedCosine - a.weightedCosine);

  if (matches.length === 0) return { score: baseScore, cosineScore: null };

  const bestCosine = matches[0].cosine;
  const topWindow = matches.slice(0, Math.min(3, matches.length));
  const topAverage = topWindow.reduce((sum, m) => sum + m.cosine, 0) / topWindow.length;
  const fusedCosine = postureType === "marching" ? bestCosine * 0.9 + topAverage * 0.1 : bestCosine * 0.75 + topAverage * 0.25;
  const cosineScore = Math.round(Math.max(0, Math.min(100, ((fusedCosine + 1) / 2) * 100)));

  const cosineWeight = postureType === "attention"
    ? (avgConfidence >= 0.7 ? 0.52 : avgConfidence >= 0.5 ? 0.4 : 0.26)
    : postureType === "marching"
      ? (avgConfidence >= 0.7 ? 0.18 : avgConfidence >= 0.5 ? 0.12 : 0.08)
      : (avgConfidence >= 0.7 ? 0.35 : avgConfidence >= 0.5 ? 0.25 : 0.15);

  const blendedScore = Math.round(baseScore * (1 - cosineWeight) + cosineScore * cosineWeight);
  return { score: blendedScore, cosineScore };
}
