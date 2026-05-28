/**
 * Drill Standards & Thresholds Configuration
 *
 * Methodology Note (Chapter 3):
 * All thresholds in this file are derived from Philippine Army Manual 8-0107
 * specifications for military drill and ceremonies. Body-relative ratios are
 * used instead of absolute pixel values to ensure scale-invariant evaluation
 * across different camera distances and resolutions.
 *
 * The deduction model starts each drill at 100 points and subtracts for
 * each detected violation. Thresholds define the boundary between severity
 * levels (good → warning → error → fail).
 */

// ---------------------------------------------------------------------------
// Salutation Drill Thresholds
// ---------------------------------------------------------------------------

/**
 * Thresholds for the Hand Salute (Proper Salutation) drill.
 *
 * Per PA Manual 8-0107 Section 4:
 * - Right hand raised to forehead, forefinger near right eyebrow
 * - Upper arm approximately horizontal
 * - Forearm inclined at ~45 degrees
 * - Left arm straight at side
 * - Body remains at attention
 */
export const SALUTATION_THRESHOLDS = {
  /** Hand-to-reference-point distance ratio (relative to torso height). */
  handToRefRatio: { warning: 0.35, error: 0.55 },
  /** Vertical distance of hand above head (relative to torso height) — too high. */
  handFarAboveHead: 0.20,
  /** Vertical distance of hand below head (relative to torso height) — too low. */
  handBelowForehead: 0.20,
  /** Hand on top of head detection threshold. */
  handOnTopOfHead: { yThreshold: 0.10, xThreshold: 0.3 },
  /** Elbow drop ratio (elbow.y - shoulder.y) / torsoHeight. */
  elbowDropRatio: { warning: 0.12, error: 0.25 },
  /** Forearm angle range (degrees) — should be ~45°. */
  forearmAngle: { min: 20, max: 100 },
  /** Head horizontal offset ratio (relative to shoulder width). */
  headOffRatio: { warning: 0.25, error: 0.45 },
  /** Body lean ratio (head-hip x-offset / torso height). */
  bodyLeanRatio: { warning: 0.15, error: 0.30 },
  /** Left arm lateral offset from shoulder (relative to shoulder width). */
  leftArmXOffRatio: 0.70,
  /** Two-hand salute rejection: left hand near head distance ratio. */
  twoHandSaluteRatio: 0.40,
  /** Shoulder level difference (absolute y). */
  shoulderLevelDiff: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Attention Drill Thresholds
// ---------------------------------------------------------------------------

/**
 * Thresholds for the Position of Attention drill.
 *
 * Per PA Manual 8-0107 Section 3:
 * - Head erect, face straight to the front
 * - Shoulders square, level
 * - Arms hanging straight at sides
 * - Heels together, toes forming a 45-degree angle
 * - Body weight resting equally on heels and balls of feet
 */
export const ATTENTION_THRESHOLDS = {
  /** Head horizontal offset (absolute x). */
  headOffset: { warning: 0.04, error: 0.06, fail: 0.10 },
  /** Shoulder level difference (absolute y). */
  shoulderDiff: { warning: 0.035, error: 0.06 },
  /** Arm position: hand distance from hip y-axis tolerance. */
  armYTolerance: 0.04,
  /** Arm position: hand distance from shoulder x-axis. */
  armXFromShoulder: 0.12,
  /** Right hand raised above shoulder = salute rejection. */
  rightHandRaisedOffset: 0.03,
  /** Elbow straightness angles. */
  elbowAngle: { warning: 160, error: 145 },
  /** Body lean ratio. */
  bodyLeanRatio: { warning: 0.10, error: 0.18, fail: 0.35 },
  /** Body symmetry offset (shoulder-hip mid-x difference). */
  symmetryOffset: { warning: 0.035, error: 0.06 },
  /** Knee straightness angles. */
  kneeAngle: { warning: 165, error: 155 },
  /** Feet spacing (body-relative to hip width). */
  feetToHipRatio: { warning: 0.60, error: 0.80, fail: 1.1 },
  /** Feet spacing absolute fallback. */
  feetSpacingAbsolute: { warning: 0.07, error: 0.12 },
  /** Head-hips alignment threshold (absolute x). */
  headHipsAlignment: 0.09,
  /** Ear confidence asymmetry for head rotation detection. */
  earAsymmetry: { confDiff: 0.35, minConf: 0.15 },
  /** Eye confidence asymmetry for head rotation detection. */
  eyeAsymmetry: { confDiff: 0.3, minConf: 0.2 },
  /** Eye tilt ratio for head tilt detection. */
  eyeTiltRatio: 0.35,
} as const;

// ---------------------------------------------------------------------------
// Marching Drill Thresholds
// ---------------------------------------------------------------------------

/**
 * Thresholds for the Marching in Place drill.
 *
 * Per PA Manual 8-0107:
 * - Alternating leg lift with proper knee elevation
 * - Body remains upright, shoulders level
 * - Arms at sides, no excessive swinging
 * - Steady cadence
 */
export const MARCHING_THRESHOLDS = {
  /** Foot lift ratio (relative to leg length). */
  footLiftRatio: { minimum: 0.04, low: 0.08, adequate: 0.12 },
  /** Knee bend angle (degrees) — below this = not enough bend. */
  kneeAngleMax: 160,
  /** Body lean ratio during march. */
  bodyLeanRatio: { warning: 0.10, error: 0.18, fail: 0.30 },
  /** Shoulder level ratio (relative to torso height). */
  shoulderDiffRatio: { warning: 0.10, error: 0.18 },
  /** Arm position: lateral tolerance from shoulder (relative to shoulder width). */
  armXMaxRatio: 0.60,
  /** Arm position: vertical tolerance from hips (relative to torso height). */
  armYToleranceRatio: 0.10,
  /** Head offset ratio (relative to shoulder width). */
  headOffRatio: { warning: 0.25, error: 0.45 },
  /** Hip symmetry ratio (relative to torso height). */
  hipDiffRatio: { warning: 0.12, error: 0.20 },
} as const;

// ---------------------------------------------------------------------------
// Temporal Smoothing Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for temporal score smoothing.
 *
 * Methodology Note (Chapter 3):
 * Frame-by-frame pose detection produces noisy scores. Temporal smoothing
 * applies statistical filters to produce stable, human-readable results:
 * - EMA (Exponential Moving Average) for static postures
 * - Rolling median buffer with grace period for marching
 */
export const TEMPORAL_CONFIG = {
  /** EMA smoothing factor for static postures (attention, salutation). */
  scoreEmaAlpha: 0.35,
  /** Minimum interval between corrections updates (ms). */
  correctionsDebounceMs: 400,
  /** Marching-specific debounce (ms). */
  marchingCorrectionsDebounceMs: 600,
  /** Rolling buffer size for marching score median. */
  marchScoreBufferSize: 8,
  /** Number of consecutive bad frames before unlocking fail state. */
  marchBadFrameThreshold: 4,
  /** Grace period (ms) after last good step before declaring fail. */
  marchGraceMs: 600,
} as const;

// ---------------------------------------------------------------------------
// Detection Loop Configuration
// ---------------------------------------------------------------------------

/** Skeleton rendering interval (~16 FPS visual loop). */
export const SKELETON_LOOP_INTERVAL = 60;

/** Score analysis interval (~3 FPS scoring loop). */
export const SCORE_ANALYSIS_INTERVAL = 300;

/** Cooldown for manual live save (ms). */
export const MANUAL_LIVE_SAVE_COOLDOWN_MS = 5000;

/** Interval for live save reminder toast (ms). */
export const LIVE_SAVE_REMINDER_MS = 25000;

/** Minimum interval between aggregated stats refreshes (ms). */
export const STATS_REFRESH_INTERVAL = 30000;

// ---------------------------------------------------------------------------
// Visibility Thresholds
// ---------------------------------------------------------------------------

/** Minimum confidence for a keypoint to be considered "visible". */
export const VISIBILITY_CONFIDENCE = 0.3;

/** Portrait aspect ratio (9:16). */
export const PORTRAIT_ASPECT_RATIO = 9 / 16;
