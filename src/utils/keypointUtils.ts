/**
 * Keypoint Mapping & Extraction Utilities
 *
 * Methodology Note (Chapter 3):
 * The MoveNet model outputs 17 COCO-format keypoints. These utilities
 * convert them into the custom 17-point body model used by AlignMate's
 * drill evaluators. The custom model adds synthetic points (Neck, Hips
 * center, Glutes, Feet) by interpolating or extending detected landmarks.
 *
 * Two mappers exist:
 * 1. mapMoveNetToCustom  — pixel-space → normalised [0,1], used by the
 *    real-time MoveNet detection loop.
 * 2. mapStandardToCustom — already-normalised COCO keypoints → custom
 *    order, used by the hybrid/local ONNX pipeline.
 */

import type { CustomKeypoint } from "../drills/types";
import type * as poseDetection from "@tensorflow-models/pose-detection";

/** Estimated extension factor from ankle to foot tip. */
const ESTIMATED_FOOT_EXTENSION = 0.18;

// ---------------------------------------------------------------------------
// 1. MoveNet → Custom (pixel-space → normalised)
// ---------------------------------------------------------------------------

/**
 * Maps raw MoveNet COCO keypoints (pixel coordinates) into the custom
 * 17-point normalised body model.
 *
 * @param keypoints - Raw MoveNet keypoints array
 * @param width     - Video width in pixels
 * @param height    - Video height in pixels
 * @returns Custom keypoints with coordinates in [0, 1]
 */
export function mapMoveNetToCustom(
  keypoints: poseDetection.Keypoint[],
  width: number,
  height: number,
): CustomKeypoint[] {
  const getKeypoint = (name: string) =>
    keypoints.find((kp) => kp.name === name);

  const nose = getKeypoint("nose");
  const leftEye = getKeypoint("left_eye");
  const rightEye = getKeypoint("right_eye");
  const leftEar = getKeypoint("left_ear");
  const rightEar = getKeypoint("right_ear");
  const leftShoulder = getKeypoint("left_shoulder");
  const rightShoulder = getKeypoint("right_shoulder");
  const leftElbow = getKeypoint("left_elbow");
  const rightElbow = getKeypoint("right_elbow");
  const leftWrist = getKeypoint("left_wrist");
  const rightWrist = getKeypoint("right_wrist");
  const leftHip = getKeypoint("left_hip");
  const rightHip = getKeypoint("right_hip");
  const leftKnee = getKeypoint("left_knee");
  const rightKnee = getKeypoint("right_knee");
  const leftAnkle = getKeypoint("left_ankle");
  const rightAnkle = getKeypoint("right_ankle");

  const facePoints = [nose, leftEye, rightEye, leftEar, rightEar].filter(
    (p): p is NonNullable<typeof p> => Boolean(p && (p.score ?? 0) > 0.2),
  );

  if ((!leftShoulder && !rightShoulder) || (!leftHip && !rightHip)) {
    return [];
  }

  // Normalization helper
  const norm = (val: number, max: number) => {
    if (!max || max <= 0) return 0;
    return Math.max(0, Math.min(1, val / max));
  };

  const resolvedLeftShoulder = leftShoulder ?? rightShoulder;
  const resolvedRightShoulder = rightShoulder ?? leftShoulder;
  const resolvedLeftHip = leftHip ?? rightHip;
  const resolvedRightHip = rightHip ?? leftHip;

  const shoulderCenter = {
    x: ((resolvedLeftShoulder?.x ?? 0) + (resolvedRightShoulder?.x ?? 0)) / 2,
    y: ((resolvedLeftShoulder?.y ?? 0) + (resolvedRightShoulder?.y ?? 0)) / 2,
    score:
      ((resolvedLeftShoulder?.score ?? 0) +
        (resolvedRightShoulder?.score ?? 0)) /
      2,
  };
  const hipCenter = {
    x: ((resolvedLeftHip?.x ?? 0) + (resolvedRightHip?.x ?? 0)) / 2,
    y: ((resolvedLeftHip?.y ?? 0) + (resolvedRightHip?.y ?? 0)) / 2,
    score:
      ((resolvedLeftHip?.score ?? 0) + (resolvedRightHip?.score ?? 0)) / 2,
  };
  const torsoHeightPx = Math.max(
    18,
    Math.abs(hipCenter.y - shoulderCenter.y),
  );

  // Midpoint helper
  const midPoint = (p1: any, p2: any, name: string): CustomKeypoint => ({
    x: norm((p1.x + p2.x) / 2, width),
    y: norm((p1.y + p2.y) / 2, height),
    confidence: ((p1.score ?? 0) + (p2.score ?? 0)) / 2,
    name,
  });

  // Point creation helper
  const createPoint = (p: any, name: string): CustomKeypoint => ({
    x: norm(p.x, width),
    y: norm(p.y, height),
    confidence: p.score ?? 0,
    name,
  });

  const createFallbackPoint = (
    primary: any,
    fallback: any,
    name: string,
  ): CustomKeypoint =>
    createPoint(
      primary ?? {
        x: fallback.x,
        y: fallback.y,
        score: Math.max(0.12, (fallback.score ?? 0) * 0.6),
      },
      name,
    );

  const headPoint =
    facePoints.length > 0
      ? {
          x:
            facePoints.reduce((sum, point) => sum + point.x, 0) /
            facePoints.length,
          y:
            facePoints.reduce((sum, point) => sum + point.y, 0) /
            facePoints.length,
          score:
            facePoints.reduce((sum, point) => sum + (point.score || 0), 0) /
            facePoints.length,
        }
      : {
          x: shoulderCenter.x,
          y: Math.max(0, shoulderCenter.y - torsoHeightPx * 0.45),
          score: Math.max(0.2, shoulderCenter.score),
        };

  // MoveNet does not provide toe/foot keypoints.
  // Estimate feet by extending the knee->ankle direction slightly downward.
  const estimateFootPoint = (
    ankle: any,
    knee: any,
    name: string,
  ): CustomKeypoint | null => {
    if (!ankle) return null;
    const dx = knee ? ankle.x - knee.x : 0;
    const dy = knee ? ankle.y - knee.y : Math.max(18, height * 0.03);
    const extension = ESTIMATED_FOOT_EXTENSION;
    const footX = ankle.x + dx * extension;
    const footY = ankle.y + dy * extension;

    return {
      x: norm(Math.max(0, Math.min(width, footX)), width),
      y: norm(Math.max(0, Math.min(height, footY)), height),
      confidence: ankle.score,
      name,
    };
  };

  const leftFoot = estimateFootPoint(leftAnkle, leftKnee, "Feet");
  const rightFoot = estimateFootPoint(rightAnkle, rightKnee, "Feet");

  return [
    createPoint(headPoint, "Head"),
    midPoint(resolvedLeftShoulder, resolvedRightShoulder, "Neck"),
    createPoint(resolvedLeftShoulder, "Shoulder"),
    createFallbackPoint(leftElbow, resolvedLeftShoulder, "Elbow"),
    createFallbackPoint(
      leftWrist,
      leftElbow ?? resolvedLeftShoulder,
      "Hands",
    ),
    createPoint(resolvedRightShoulder, "Shoulder"),
    createFallbackPoint(rightElbow, resolvedRightShoulder, "Elbow"),
    midPoint(resolvedLeftHip, resolvedRightHip, "Hips"),
    createFallbackPoint(
      rightWrist,
      rightElbow ?? resolvedRightShoulder,
      "Hands",
    ),
    createPoint(resolvedLeftHip, "Glute"),
    createPoint(resolvedRightHip, "Glute"),
    createFallbackPoint(leftKnee, resolvedLeftHip, "Knee"),
    createFallbackPoint(rightKnee, resolvedRightHip, "Knee"),
    createFallbackPoint(leftAnkle, leftKnee ?? resolvedLeftHip, "Ankle"),
    createFallbackPoint(rightAnkle, rightKnee ?? resolvedRightHip, "Ankle"),
    leftFoot ??
      createFallbackPoint(leftAnkle, leftKnee ?? resolvedLeftHip, "Feet"),
    rightFoot ??
      createFallbackPoint(rightAnkle, rightKnee ?? resolvedRightHip, "Feet"),
  ];
}

// ---------------------------------------------------------------------------
// 2. Standard/Hybrid → Custom (already-normalised COCO → custom order)
// ---------------------------------------------------------------------------

/**
 * Converts normalised COCO-style keypoints (from hybrid/local ONNX pipeline)
 * into the custom 17-point order used by drawSkeleton.
 *
 * Unlike `mapMoveNetToCustom`, this mapper does NOT normalise coordinates
 * because the input is already in [0, 1].
 */
export function mapStandardToCustom(
  keypoints: any[],
): CustomKeypoint[] {
  if (!keypoints || keypoints.length === 0) return [];

  const getKeypoint = (name: string) =>
    keypoints.find((kp) => kp && kp.name === name);

  const nose = getKeypoint("nose");
  const leftEye = getKeypoint("left_eye");
  const rightEye = getKeypoint("right_eye");
  const leftEar = getKeypoint("left_ear");
  const rightEar = getKeypoint("right_ear");
  const leftShoulder = getKeypoint("left_shoulder");
  const rightShoulder = getKeypoint("right_shoulder");
  const leftElbow = getKeypoint("left_elbow");
  const rightElbow = getKeypoint("right_elbow");
  const leftWrist = getKeypoint("left_wrist");
  const rightWrist = getKeypoint("right_wrist");
  const leftHip = getKeypoint("left_hip");
  const rightHip = getKeypoint("right_hip");
  const leftKnee = getKeypoint("left_knee");
  const rightKnee = getKeypoint("right_knee");
  const leftAnkle = getKeypoint("left_ankle");
  const rightAnkle = getKeypoint("right_ankle");

  const facePoints = [nose, leftEye, rightEye, leftEar, rightEar].filter(
    (p): p is NonNullable<typeof p> =>
      Boolean(p && (p.confidence ?? 0) > 0.2),
  );

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return [];

  const midpoint = (p1: any, p2: any, name: string): CustomKeypoint => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
    confidence: ((p1.confidence ?? 0) + (p2.confidence ?? 0)) / 2,
    name,
  });

  const point = (p: any, name: string): CustomKeypoint => ({
    x: p?.x ?? 0,
    y: p?.y ?? 0,
    confidence: p?.confidence ?? 0,
    name,
  });

  const safeFoot = (
    ankle: any,
    knee: any,
    name: string,
  ): CustomKeypoint | null => {
    if (!ankle) return null;
    const dx = knee ? ankle.x - knee.x : 0;
    const dy = knee ? ankle.y - knee.y : 0.03;
    const extension = ESTIMATED_FOOT_EXTENSION;
    return {
      x: Math.max(0, Math.min(1, ankle.x + dx * extension)),
      y: Math.max(0, Math.min(1, ankle.y + dy * extension)),
      confidence: ankle.confidence ?? 0,
      name,
    };
  };

  const head =
    facePoints.length > 0
      ? {
          x: facePoints.reduce((sum, p) => sum + p.x, 0) / facePoints.length,
          y: facePoints.reduce((sum, p) => sum + p.y, 0) / facePoints.length,
          confidence:
            facePoints.reduce((sum, p) => sum + (p.confidence ?? 0), 0) /
            facePoints.length,
          name: "Head",
        }
      : midpoint(leftShoulder, rightShoulder, "Head");

  const leftFoot = safeFoot(leftAnkle, leftKnee, "Feet");
  const rightFoot = safeFoot(rightAnkle, rightKnee, "Feet");

  return [
    head,
    midpoint(leftShoulder, rightShoulder, "Neck"),
    point(leftShoulder, "Shoulder"),
    point(leftElbow, "Elbow"),
    point(leftWrist, "Hands"),
    point(rightShoulder, "Shoulder"),
    point(rightElbow, "Elbow"),
    midpoint(leftHip, rightHip, "Hips"),
    point(rightWrist, "Hands"),
    point(leftHip, "Glute"),
    point(rightHip, "Glute"),
    point(leftKnee, "Knee"),
    point(rightKnee, "Knee"),
    point(leftAnkle, "Ankle"),
    point(rightAnkle, "Ankle"),
    leftFoot ?? point(leftAnkle, "Feet"),
    rightFoot ?? point(rightAnkle, "Feet"),
  ];
}

// ---------------------------------------------------------------------------
// Keypoint Visibility Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the keypoint at the given index if its confidence exceeds the threshold.
 */
export function getVisibleKeypoint(
  keypoints: CustomKeypoint[],
  index: number,
  minConfidence = 0.3,
): CustomKeypoint | null {
  const kp = keypoints[index];
  return kp && kp.confidence > minConfidence ? kp : null;
}

/**
 * Returns true if the keypoint at the given index is visible.
 */
export function isKeypointVisible(
  keypoints: CustomKeypoint[],
  index: number,
  minConfidence = 0.3,
): boolean {
  return getVisibleKeypoint(keypoints, index, minConfidence) !== null;
}
