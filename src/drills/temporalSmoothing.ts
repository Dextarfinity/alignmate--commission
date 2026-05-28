/**
 * Temporal Score Smoothing — State Machine
 *
 * Methodology Note (Chapter 3):
 * Frame-by-frame pose detection produces noisy scores. This class
 * applies statistical filters to produce stable, human-readable results:
 * - EMA (Exponential Moving Average) for static postures (attention, salutation)
 * - Rolling median buffer + grace period state machine for marching
 *
 * The marching smoother uses a "locked pass" strategy:
 * 1. Once the cadet achieves a good step, the score is locked to passing
 * 2. A grace period prevents flickering during leg transitions
 * 3. Only after sustained bad frames does the score unlock and drop
 *
 * This mirrors the instructor evaluation approach: brief hesitations
 * during cadence are tolerated, but sustained poor form is penalized.
 */

import type { PostureScoreResult, BodyPartCorrection } from "./types";
import { TEMPORAL_CONFIG } from "../config/drillStandards";

// ---------------------------------------------------------------------------
// Smoothed Result
// ---------------------------------------------------------------------------

export interface SmoothedResult {
  score: number;
  passed: boolean;
  corrections: BodyPartCorrection[];
  errorKeypointIndices: number[];
  warningKeypointIndices: number[];
}

// ---------------------------------------------------------------------------
// DrillTemporalSmoother
// ---------------------------------------------------------------------------

export class DrillTemporalSmoother {
  // --- EMA state (static postures) ---
  private smoothedScore = 0;
  private hasInitialScore = false;

  // --- Rolling buffer state (marching) ---
  private scoreBuffer: number[] = [];
  private consecutiveBad = 0;
  private lastGoodStepAt = 0;
  private lockedPass = false;

  // --- Corrections debounce ---
  private lastCorrections: BodyPartCorrection[] = [];
  private lastErrorKp: number[] = [];
  private lastWarningKp: number[] = [];
  private lastCorrectionTime = 0;

  /**
   * Smooth a static posture score (attention, salutation) using EMA.
   */
  updateStatic(result: PostureScoreResult, now = Date.now()): SmoothedResult {
    const alpha = TEMPORAL_CONFIG.scoreEmaAlpha;

    if (!this.hasInitialScore) {
      this.smoothedScore = result.score;
      this.hasInitialScore = true;
    } else {
      this.smoothedScore =
        alpha * result.score + (1 - alpha) * this.smoothedScore;
    }

    const score = Math.round(this.smoothedScore);
    const corrections = this.debounceCorrections(result.corrections, now);

    return {
      score,
      passed: score >= 75,
      corrections,
      errorKeypointIndices: this.lastErrorKp,
      warningKeypointIndices: this.lastWarningKp,
    };
  }

  /**
   * Smooth a marching score using rolling median + grace period.
   *
   * Methodology Note (Chapter 3):
   * The rolling median is more robust to outliers than the mean.
   * The grace period (600ms default) prevents the score from dropping
   * during the brief moment between leg transitions when no lift
   * is detected in the current frame.
   */
  updateMarching(result: PostureScoreResult, now = Date.now()): SmoothedResult {
    const bufSize = TEMPORAL_CONFIG.marchScoreBufferSize;
    const badThreshold = TEMPORAL_CONFIG.marchBadFrameThreshold;
    const graceMs = TEMPORAL_CONFIG.marchGraceMs;

    // Add to rolling buffer
    this.scoreBuffer.push(result.score);
    if (this.scoreBuffer.length > bufSize) this.scoreBuffer.shift();

    // Rolling median
    const sorted = [...this.scoreBuffer].sort((a, b) => a - b);
    const medianScore = sorted[Math.floor(sorted.length / 2)];

    // Grace period logic
    const isGoodFrame = result.score >= 75;
    if (isGoodFrame) {
      this.lastGoodStepAt = now;
      this.consecutiveBad = 0;
      this.lockedPass = true;
    } else {
      this.consecutiveBad++;
    }

    const withinGrace = now - this.lastGoodStepAt < graceMs;
    const shouldUnlock = this.consecutiveBad >= badThreshold && !withinGrace;
    if (shouldUnlock) this.lockedPass = false;

    let finalScore: number;
    if (this.lockedPass) {
      finalScore = Math.max(medianScore, 75);
    } else {
      finalScore = medianScore;
    }

    const corrections = this.debounceCorrections(
      result.corrections,
      now,
      TEMPORAL_CONFIG.marchingCorrectionsDebounceMs,
    );

    return {
      score: finalScore,
      passed: finalScore >= 75,
      corrections,
      errorKeypointIndices: this.lastErrorKp,
      warningKeypointIndices: this.lastWarningKp,
    };
  }

  /**
   * Debounce corrections to prevent visual flicker in the coaching panel.
   */
  private debounceCorrections(
    newCorrections: BodyPartCorrection[],
    now: number,
    debounceMs: number = TEMPORAL_CONFIG.correctionsDebounceMs,
  ): BodyPartCorrection[] {
    if (now - this.lastCorrectionTime >= debounceMs) {
      this.lastCorrections = newCorrections;
      this.lastErrorKp = newCorrections
        .filter((c) => c.status === "fail" || c.status === "error")
        .flatMap(() => []);
      this.lastWarningKp = newCorrections
        .filter((c) => c.status === "warning")
        .flatMap(() => []);
      this.lastCorrectionTime = now;
    }
    return this.lastCorrections;
  }

  /**
   * Reset all temporal state. Called when switching drills or restarting.
   */
  reset(): void {
    this.smoothedScore = 0;
    this.hasInitialScore = false;
    this.scoreBuffer = [];
    this.consecutiveBad = 0;
    this.lastGoodStepAt = 0;
    this.lockedPass = false;
    this.lastCorrections = [];
    this.lastErrorKp = [];
    this.lastWarningKp = [];
    this.lastCorrectionTime = 0;
  }
}
