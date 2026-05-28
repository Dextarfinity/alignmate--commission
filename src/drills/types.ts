/**
 * Drill Types & Interfaces
 *
 * Methodology Note (Chapter 3):
 * These types define the data structures used across both the real-time
 * deduction engine (MoveNet skeleton overlay) and the template-matching
 * engine (ONNX local model). Separating them ensures consistent contracts
 * between the scoring pipeline stages:
 *   Camera Feed → Pose Detection → Drill Module → Scoring Algorithm → Feedback
 */

// ---------------------------------------------------------------------------
// Drill / Posture Enums
// ---------------------------------------------------------------------------

/** The three drill types supported by AlignMate. */
export type DrillType = "salutation" | "marching" | "attention";

// ---------------------------------------------------------------------------
// Posture Metadata
// ---------------------------------------------------------------------------

/** UI-facing metadata for each drill. */
export interface PostureTypeInfo {
  title: string;
  instructions: string;
  checkpoints: string[];
}

// ---------------------------------------------------------------------------
// Keypoint Types
// ---------------------------------------------------------------------------

/**
 * A normalised keypoint in the custom 17-point body model.
 * Coordinates are in [0, 1] relative to the video / image dimensions.
 */
export interface CustomKeypoint {
  x: number;
  y: number;
  confidence: number;
  name: string;
}

/** Ideal reference keypoint used for overlay guide and distance scoring. */
export interface IdealPoint {
  x: number;
  y: number;
  confidence: number;
  name: string;
}

/**
 * Raw MoveNet keypoint (COCO 17-point format).
 * `score` is the detection confidence supplied by TF.js MoveNet.
 */
export interface RawMoveNetKeypoint {
  x: number;
  y: number;
  score?: number;
  name?: string;
}

// ---------------------------------------------------------------------------
// Correction / Feedback Types
// ---------------------------------------------------------------------------

/**
 * Severity levels for per-body-part corrections.
 *
 * Methodology Note (Chapter 3):
 * The four-tier severity model maps directly to the coaching HUD:
 *   - good:    Body part is in correct position (green)
 *   - warning: Minor deviation, may self-correct (yellow)
 *   - error:   Significant deviation, deduction applied (orange)
 *   - fail:    Hard-fail condition, score capped (red)
 */
export type CorrectionSeverity = "good" | "warning" | "error" | "fail";

/** A single body-part correction produced by a drill evaluator. */
export interface BodyPartCorrection {
  bodyPart: string;
  icon: string;
  status: CorrectionSeverity;
  suggestion: string;
  deduction: number;
}

// ---------------------------------------------------------------------------
// Scoring Result
// ---------------------------------------------------------------------------

/**
 * The result returned by every drill evaluator function.
 *
 * Methodology Note (Chapter 3):
 * This structure captures both the quantitative score and the qualitative
 * corrections array, enabling the Camera UI to render the real-time
 * coaching panel while simultaneously tracking which skeleton keypoints
 * should be highlighted as errors or warnings on the canvas overlay.
 */
export interface PostureScoreResult {
  /** Final score 0-100 after deductions, blending, and score-cap. */
  score: number;
  /** Whether the score >= 75 (passing threshold). */
  passed: boolean;
  /** Per-body-part correction details for the coaching HUD. */
  corrections: BodyPartCorrection[];
  /** Indices of keypoints belonging to body parts with errors. */
  errorKeypointIndices: number[];
  /** Indices of keypoints belonging to body parts with warnings. */
  warningKeypointIndices: number[];
}

// ---------------------------------------------------------------------------
// Scan Result (UI)
// ---------------------------------------------------------------------------

/** Result object displayed in the scan result overlay. */
export interface ScanResult {
  success: boolean;
  score: number;
  feedback: string;
  posture?: string;
  confidence?: number;
  recommendations?: string[];
  timestamp?: string;
  image?: string;
}

/** Camera error displayed when the camera cannot be accessed. */
export interface CameraError {
  title: string;
  message: string;
  action: string;
}

// ---------------------------------------------------------------------------
// Custom Keypoint Index Constants
// ---------------------------------------------------------------------------

/**
 * Index mapping for the custom 17-point body model produced by
 * `mapMoveNetToCustom()`. These indices correspond to the array
 * positions returned by that function.
 *
 * Methodology Note (Chapter 3):
 * The custom mapping re-orders the COCO keypoints into a layout
 * optimised for military drill evaluation:
 *   [Head, Neck, L-Shoulder, L-Elbow, L-Hand, R-Shoulder, R-Elbow,
 *    Hips, R-Hand, L-Glute, R-Glute, L-Knee, R-Knee, L-Ankle, R-Ankle,
 *    L-Foot, R-Foot]
 */
export const KP = {
  HEAD: 0,
  NECK: 1,
  LEFT_SHOULDER: 2,
  LEFT_ELBOW: 3,
  LEFT_HAND: 4,
  RIGHT_SHOULDER: 5,
  RIGHT_ELBOW: 6,
  HIPS_CENTER: 7,
  RIGHT_HAND: 8,
  LEFT_HIP: 9,
  RIGHT_HIP: 10,
  LEFT_KNEE: 11,
  RIGHT_KNEE: 12,
  LEFT_ANKLE: 13,
  RIGHT_ANKLE: 14,
  LEFT_FOOT: 15,
  RIGHT_FOOT: 16,
} as const;
