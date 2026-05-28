/**
 * Skeleton Renderer — Canvas Drawing Utilities
 *
 * Methodology Note (Chapter 3):
 * The skeleton overlay provides real-time visual feedback by rendering
 * the detected body pose directly on the camera feed. Keypoints are
 * colour-coded based on the drill evaluator's corrections:
 *   - Green (#34d399):  Score ≥ 75, correct form
 *   - Yellow (#fbbf24): Score 50-74, needs adjustment
 *   - Red (#f87171):    Score < 50 or per-keypoint error
 *
 * Error keypoints are rendered larger with a pulsing ring to draw
 * the cadet's attention to the specific body part needing correction.
 *
 * DPR (Device Pixel Ratio) scaling is applied so lines remain crisp
 * on high-density mobile displays.
 */

import type { CustomKeypoint } from "../drills/types";

// ---------------------------------------------------------------------------
// Skeleton Connection Map
// ---------------------------------------------------------------------------

/**
 * Connections between custom 17-point keypoints for skeleton line drawing.
 * Each pair [a, b] defines a bone segment.
 */
const SKELETON_CONNECTIONS: [number, number][] = [
  [0, 1],   // Head -> Neck
  [1, 2],   // Neck -> Left Shoulder
  [1, 5],   // Neck -> Right Shoulder
  [2, 3],   // Left Shoulder -> Left Elbow
  [3, 4],   // Left Elbow -> Left Hand
  [5, 6],   // Right Shoulder -> Right Elbow
  [6, 8],   // Right Elbow -> Right Hand
  [1, 7],   // Neck -> Hips
  [7, 9],   // Hips -> Left Glute
  [7, 10],  // Hips -> Right Glute
  [9, 11],  // Left Glute -> Left Knee
  [11, 13], // Left Knee -> Left Ankle
  [13, 15], // Left Ankle -> Left Foot
  [10, 12], // Right Glute -> Right Knee
  [12, 14], // Right Knee -> Right Ankle
  [14, 16], // Right Ankle -> Right Foot
];

// ---------------------------------------------------------------------------
// Score-Based Colour Selection
// ---------------------------------------------------------------------------

function getLineColor(score: number): string {
  if (score >= 75) return "#10b981"; // emerald-500
  if (score >= 50) return "#f59e0b"; // amber-500
  return "#ef4444";                   // red-500
}

function getPointColor(score: number): string {
  if (score >= 75) return "#34d399"; // emerald-400
  if (score >= 50) return "#fbbf24"; // yellow-400
  return "#f87171";                   // red-400
}

// ---------------------------------------------------------------------------
// DPR-Aware Canvas Setup
// ---------------------------------------------------------------------------

/**
 * Configures the canvas dimensions and transform to match the display
 * element's CSS size multiplied by the device pixel ratio.
 *
 * @returns The display-space width and height for coordinate calculations.
 */
function setupCanvasDPR(
  canvas: HTMLCanvasElement,
): { displayWidth: number; displayHeight: number } {
  const displayWidth = Math.max(
    1,
    Math.round(canvas.clientWidth || canvas.width),
  );
  const displayHeight = Math.max(
    1,
    Math.round(canvas.clientHeight || canvas.height),
  );
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const targetWidth = Math.round(displayWidth * dpr);
  const targetHeight = Math.round(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext("2d");
  if (ctx) {
    const scaleX = canvas.width / displayWidth;
    const scaleY = canvas.height / displayHeight;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  }

  return { displayWidth, displayHeight };
}

// ---------------------------------------------------------------------------
// drawIdealPoseGuide
// ---------------------------------------------------------------------------

/**
 * Clears the canvas and sets up DPR scaling for fresh drawing.
 * Called before each frame to prepare the overlay surface.
 */
export function drawIdealPoseGuide(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
): void {
  if (!canvas || !video) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const displayWidth = Math.max(
    1,
    Math.round(canvas.clientWidth || video.clientWidth || video.videoWidth),
  );
  const displayHeight = Math.max(
    1,
    Math.round(canvas.clientHeight || video.clientHeight || video.videoHeight),
  );
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const targetWidth = Math.round(displayWidth * dpr);
  const targetHeight = Math.round(displayHeight * dpr);

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const scaleX = canvas.width / displayWidth;
  const scaleY = canvas.height / displayHeight;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  // Clear previous drawing
  ctx.clearRect(0, 0, displayWidth, displayHeight);
}

// ---------------------------------------------------------------------------
// drawSkeleton
// ---------------------------------------------------------------------------

/**
 * Renders the detected skeleton overlay on the canvas.
 *
 * @param customKeypoints     - Custom 17-point body model keypoints
 * @param score               - Current posture score (determines colour)
 * @param canvas              - Target canvas element
 * @param sourceVideoWidth    - Original video width (for object-cover mapping)
 * @param sourceVideoHeight   - Original video height
 * @param errorKeypointIndices   - Keypoint indices to highlight as errors
 * @param warningKeypointIndices - Keypoint indices to highlight as warnings
 */
export function drawSkeleton(
  customKeypoints: CustomKeypoint[],
  score: number,
  canvas: HTMLCanvasElement | null,
  sourceVideoWidth?: number,
  sourceVideoHeight?: number,
  errorKeypointIndices: number[] = [],
  warningKeypointIndices: number[] = [],
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const errorSet = new Set(errorKeypointIndices);
  const warningSet = new Set(warningKeypointIndices);

  const { displayWidth, displayHeight } = setupCanvasDPR(canvas);

  const safeVideoWidth =
    typeof sourceVideoWidth === "number" && sourceVideoWidth > 0
      ? sourceVideoWidth
      : displayWidth;
  const safeVideoHeight =
    typeof sourceVideoHeight === "number" && sourceVideoHeight > 0
      ? sourceVideoHeight
      : displayHeight;

  // Match CSS object-cover so the overlay tracks the portrait-filled preview.
  const coverScale = Math.max(
    displayWidth / Math.max(1, safeVideoWidth),
    displayHeight / Math.max(1, safeVideoHeight),
  );
  const renderedVideoWidth = safeVideoWidth * coverScale;
  const renderedVideoHeight = safeVideoHeight * coverScale;
  const offsetX = (displayWidth - renderedVideoWidth) / 2;
  const offsetY = (displayHeight - renderedVideoHeight) / 2;

  const minDimension = Math.min(displayWidth, displayHeight);
  const dynamicLineWidth = Math.max(2.2, Math.min(4.5, minDimension / 170));
  const dynamicPointRadius = Math.max(3, Math.min(5, minDimension / 130));
  const renderThreshold = 0.12;

  const lineColor = getLineColor(score);
  const pointColor = getPointColor(score);

  // Draw bone lines first
  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = dynamicLineWidth;
  ctx.globalAlpha = 1;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 6;

  SKELETON_CONNECTIONS.forEach(([a, b]) => {
    const start = customKeypoints[a];
    const end = customKeypoints[b];
    if (!start || !end) return;
    if (start.confidence < renderThreshold || end.confidence < renderThreshold)
      return;
    ctx.beginPath();
    ctx.moveTo(
      offsetX + start.x * renderedVideoWidth,
      offsetY + start.y * renderedVideoHeight,
    );
    ctx.lineTo(
      offsetX + end.x * renderedVideoWidth,
      offsetY + end.y * renderedVideoHeight,
    );
    ctx.stroke();
  });

  // Draw keypoints on top — highlight errors/warnings per body part
  ctx.shadowBlur = 0;
  customKeypoints.forEach((kp, idx) => {
    if (!kp || kp.confidence < renderThreshold) return;
    const x = offsetX + kp.x * renderedVideoWidth;
    const y = offsetY + kp.y * renderedVideoHeight;

    // Per-keypoint colour based on posture coaching status
    let kpFill = pointColor;
    let kpRadius = dynamicPointRadius;
    if (errorSet.has(idx)) {
      kpFill = "#f87171"; // red-400
      kpRadius = dynamicPointRadius * 1.35;
    } else if (warningSet.has(idx)) {
      kpFill = "#fbbf24"; // yellow-400
      kpRadius = dynamicPointRadius * 1.15;
    }

    ctx.fillStyle = kpFill;
    ctx.beginPath();
    ctx.arc(x, y, kpRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, dynamicLineWidth * 0.45);
    ctx.stroke();

    // Pulsing ring for error keypoints
    if (errorSet.has(idx)) {
      ctx.strokeStyle = "rgba(248,113,113,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, kpRadius + 4, 0, 2 * Math.PI);
      ctx.stroke();
    }
  });
  ctx.restore();
}
