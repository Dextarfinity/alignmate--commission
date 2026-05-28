/**
 * Ideal Keypoint Reference Positions & Posture Type Metadata
 *
 * Methodology Note (Chapter 3):
 * These reference keypoints represent the "gold standard" body positions
 * for each drill, normalised to [0, 1] coordinates. They serve two purposes:
 *
 * 1. Visual guide overlay — shown on-screen so the cadet can align their
 *    body to the correct position before starting detection.
 * 2. Distance scoring — the Euclidean distance between detected and ideal
 *    keypoints provides a geometric similarity baseline.
 *
 * Coordinates are designed for a 9:16 portrait frame with the subject
 * centered and filling the oval guide area.
 */

import type { IdealPoint, PostureTypeInfo, DrillType } from "../drills/types";

// ---------------------------------------------------------------------------
// Ideal Reference Keypoints (Custom 17-point model)
// ---------------------------------------------------------------------------

/** Ideal marching keypoints — left leg raised phase. */
export const IDEAL_MARCHING_LEFT: IdealPoint[] = [
  { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" },
  { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" },
  { x: 0.4, y: 0.25, confidence: 1.0, name: "Shoulder" },
  { x: 0.36, y: 0.38, confidence: 1.0, name: "Elbow" },
  { x: 0.34, y: 0.52, confidence: 1.0, name: "Hands" },
  { x: 0.6, y: 0.25, confidence: 1.0, name: "Shoulder" },
  { x: 0.64, y: 0.38, confidence: 1.0, name: "Elbow" },
  { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" },
  { x: 0.66, y: 0.52, confidence: 1.0, name: "Hands" },
  { x: 0.43, y: 0.5, confidence: 1.0, name: "Glute" },
  { x: 0.57, y: 0.5, confidence: 1.0, name: "Glute" },
  { x: 0.42, y: 0.58, confidence: 1.0, name: "Knee" },
  { x: 0.58, y: 0.67, confidence: 1.0, name: "Knee" },
  { x: 0.4, y: 0.72, confidence: 1.0, name: "Ankle" },
  { x: 0.6, y: 0.84, confidence: 1.0, name: "Ankle" },
  { x: 0.39, y: 0.79, confidence: 1.0, name: "Feet" },
  { x: 0.62, y: 0.9, confidence: 1.0, name: "Feet" },
];

/** Ideal marching keypoints — right leg raised phase. */
export const IDEAL_MARCHING_RIGHT: IdealPoint[] = [
  { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" },
  { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" },
  { x: 0.4, y: 0.25, confidence: 1.0, name: "Shoulder" },
  { x: 0.36, y: 0.38, confidence: 1.0, name: "Elbow" },
  { x: 0.34, y: 0.52, confidence: 1.0, name: "Hands" },
  { x: 0.6, y: 0.25, confidence: 1.0, name: "Shoulder" },
  { x: 0.64, y: 0.38, confidence: 1.0, name: "Elbow" },
  { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" },
  { x: 0.66, y: 0.52, confidence: 1.0, name: "Hands" },
  { x: 0.43, y: 0.5, confidence: 1.0, name: "Glute" },
  { x: 0.57, y: 0.5, confidence: 1.0, name: "Glute" },
  { x: 0.42, y: 0.67, confidence: 1.0, name: "Knee" },
  { x: 0.58, y: 0.58, confidence: 1.0, name: "Knee" },
  { x: 0.4, y: 0.84, confidence: 1.0, name: "Ankle" },
  { x: 0.6, y: 0.72, confidence: 1.0, name: "Ankle" },
  { x: 0.38, y: 0.9, confidence: 1.0, name: "Feet" },
  { x: 0.61, y: 0.79, confidence: 1.0, name: "Feet" },
];

/** Both marching phase variants for best-match scoring. */
export const IDEAL_MARCHING_VARIANTS: IdealPoint[][] = [
  IDEAL_MARCHING_LEFT,
  IDEAL_MARCHING_RIGHT,
];

/**
 * Ideal keypoints for each drill type.
 * Marching defaults to left-leg-raised; the detection loop tries both variants.
 */
export const IDEAL_KEYPOINTS: Record<string, IdealPoint[]> = {
  attention: [
    { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" },
    { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" },
    { x: 0.45, y: 0.25, confidence: 1.0, name: "Shoulder" },
    { x: 0.43, y: 0.38, confidence: 1.0, name: "Elbow" },
    { x: 0.42, y: 0.52, confidence: 1.0, name: "Hands" },
    { x: 0.55, y: 0.25, confidence: 1.0, name: "Shoulder" },
    { x: 0.57, y: 0.38, confidence: 1.0, name: "Elbow" },
    { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" },
    { x: 0.58, y: 0.52, confidence: 1.0, name: "Hands" },
    { x: 0.46, y: 0.5, confidence: 1.0, name: "Glute" },
    { x: 0.54, y: 0.5, confidence: 1.0, name: "Glute" },
    { x: 0.46, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.54, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.46, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.54, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.45, y: 0.9, confidence: 1.0, name: "Feet" },
    { x: 0.55, y: 0.9, confidence: 1.0, name: "Feet" },
  ],
  salutation: [
    { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" },
    { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" },
    { x: 0.45, y: 0.25, confidence: 1.0, name: "Shoulder" },
    { x: 0.43, y: 0.38, confidence: 1.0, name: "Elbow" },
    { x: 0.42, y: 0.52, confidence: 1.0, name: "Hands" },
    { x: 0.57, y: 0.25, confidence: 1.0, name: "Shoulder" },
    { x: 0.65, y: 0.2, confidence: 1.0, name: "Elbow" },
    { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" },
    { x: 0.55, y: 0.13, confidence: 1.0, name: "Hands" },
    { x: 0.46, y: 0.5, confidence: 1.0, name: "Glute" },
    { x: 0.54, y: 0.5, confidence: 1.0, name: "Glute" },
    { x: 0.46, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.54, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.46, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.54, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.45, y: 0.9, confidence: 1.0, name: "Feet" },
    { x: 0.55, y: 0.9, confidence: 1.0, name: "Feet" },
  ],
  marching: IDEAL_MARCHING_LEFT,
};

// ---------------------------------------------------------------------------
// Posture Type Definitions (UI Metadata)
// ---------------------------------------------------------------------------

/**
 * UI metadata for each drill type: title, instructions, and checkpoints
 * shown on the drill selection screen.
 */
export const POSTURE_TYPES: Record<DrillType, PostureTypeInfo> = {
  salutation: {
    title: "Proper Salutation",
    instructions: "Stand at attention, raise right hand to forehead",
    checkpoints: [
      "Straight posture",
      "Right hand to forehead",
      "Eyes forward",
      "Feet together",
    ],
  },
  marching: {
    title: "Marching Position",
    instructions: "Stand ready for marching command",
    checkpoints: [
      "Upright posture",
      "Arms at sides",
      "Weight balanced",
      "Ready stance",
    ],
  },
  attention: {
    title: "At Attention",
    instructions: "Stand perfectly straight with arms at sides",
    checkpoints: [
      "Straight spine",
      "Arms at sides",
      "Heels together",
      "Eyes forward",
    ],
  },
};
