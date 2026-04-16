/**
 * Local Posture Analysis Service
 * Uses local ONNX models only - fully offline capable
 * Works in web browsers and mobile apps
 */

import { localPoseDetection, type PostureAnalysis } from "./localPoseDetection";

export type PostureType = "salutation" | "marching" | "attention";

export interface HybridAnalysisResult {
  success: boolean;
  overall_score: number;
  raw_score?: number;
  posture_status: string;
  feedback: string;
  confidence: number;
  recommendations: string[];
  timestamp: string;
  source: "local" | "api" | "fallback";
  model_used?: string;
  keypoints?: any[]; // Detected pose keypoints from local model
}

class HybridPostureService {
  private localModelLoaded: boolean = false;
  private modelLoadAttempted: boolean = false;
  // [SCORING UPGRADE] Temporal smoothing state for real-time jitter reduction.
  private temporalScoreBuffers: Record<PostureType, number[]> = {
    salutation: [],
    marching: [],
    attention: [],
  };
  private temporalConfidenceBuffers: Record<PostureType, number[]> = {
    salutation: [],
    marching: [],
    attention: [],
  };
  private temporalLastUpdatedAt: Record<PostureType, number> = {
    salutation: 0,
    marching: 0,
    attention: 0,
  };
  private readonly TEMPORAL_WINDOW_SIZE = 5;
  private readonly TEMPORAL_RESET_GAP_MS = 1500;

  /**
   * Initialize local models (call this on app start)
   */
  async initialize(preferredModel: "nano" | "small" = "nano"): Promise<void> {
    if (this.modelLoadAttempted) {
      return;
    }

    this.modelLoadAttempted = true;

    try {
      console.log("🔄 Initializing local pose detection...");
      await localPoseDetection.loadModel(preferredModel);
      this.localModelLoaded = true;
      console.log("✅ Local pose detection ready");
    } catch (error) {
      console.error("❌ Failed to load local models:", error);
      this.localModelLoaded = false;
      throw error;
    }
  }

  /**
   * Get service status
   */
  getStatus(): {
    localReady: boolean;
    apiAvailable: boolean;
    preferredSource: "local" | "api";
  } {
    return {
      localReady: this.localModelLoaded,
      apiAvailable: false, // No API - local only
      preferredSource: "local",
    };
  }

  /**
   * Analyze posture using local ONNX model
   */
  async analyzePosture(
    base64Image: string,
    postureType: PostureType = "salutation",
  ): Promise<HybridAnalysisResult> {
    console.log(`🎯 Starting local posture analysis (${postureType})...`);

    // Use local detection only
    if (!this.localModelLoaded) {
      console.error("❌ Local model not loaded. Call initialize() first.");
      this.resetTemporalSmoothing(postureType);
      return this.getEnhancedFallback();
    }

    try {
      console.log("🔍 Running local pose detection...");
      const localResult = await localPoseDetection.analyzePosture(
        base64Image,
        postureType,
      );

      console.log("✅ Local detection complete:", localResult);
      const hybridResult = this.convertLocalToHybrid(localResult, "local");
      return this.applyTemporalSmoothing(hybridResult, postureType);
    } catch (error) {
      console.error("❌ Local detection failed:", error);
      this.resetTemporalSmoothing(postureType);
      return this.getEnhancedFallback();
    }
  }

  /**
   * Convert local analysis to hybrid format
   */
  private convertLocalToHybrid(
    result: PostureAnalysis,
    source: "local" | "api" | "fallback",
  ): HybridAnalysisResult {
    return {
      success: result.success,
      overall_score: result.overall_score,
      raw_score: result.raw_score,
      posture_status: result.posture_status,
      feedback: result.feedback,
      confidence: result.confidence,
      recommendations: result.recommendations || [],
      timestamp: new Date().toISOString(),
      source: source,
      model_used: result.model_used,
      keypoints: result.keypoints || [], // Include detected keypoints
    };
  }

  // [SCORING UPGRADE] Smooth score/confidence across recent frames with a recency-weighted average.
  private applyTemporalSmoothing(
    result: HybridAnalysisResult,
    postureType: PostureType,
  ): HybridAnalysisResult {
    if (result.source === "fallback") {
      this.resetTemporalSmoothing(postureType);
      return result;
    }

    const now = Date.now();
    if (
      now - this.temporalLastUpdatedAt[postureType] >
      this.TEMPORAL_RESET_GAP_MS
    ) {
      this.resetTemporalSmoothing(postureType);
    }

    this.temporalLastUpdatedAt[postureType] = now;
    this.temporalScoreBuffers[postureType].push(result.overall_score);
    this.temporalConfidenceBuffers[postureType].push(result.confidence);

    if (
      this.temporalScoreBuffers[postureType].length > this.TEMPORAL_WINDOW_SIZE
    ) {
      this.temporalScoreBuffers[postureType].shift();
    }
    if (
      this.temporalConfidenceBuffers[postureType].length >
      this.TEMPORAL_WINDOW_SIZE
    ) {
      this.temporalConfidenceBuffers[postureType].shift();
    }

    const weightedAverage = (values: number[]): number => {
      if (!values.length) return 0;
      let weightedSum = 0;
      let weightTotal = 0;

      values.forEach((value, index) => {
        const weight = index + 1;
        weightedSum += value * weight;
        weightTotal += weight;
      });

      return weightedSum / weightTotal;
    };

    const smoothedScore = Math.round(
      weightedAverage(this.temporalScoreBuffers[postureType]),
    );
    const smoothedConfidence = weightedAverage(
      this.temporalConfidenceBuffers[postureType],
    );

    return {
      ...result,
      overall_score: smoothedScore,
      confidence: smoothedConfidence,
      success: smoothedScore >= 75,
    };
  }

  // [SCORING UPGRADE] Reset smoothing when cadence breaks (manual scans, pauses, or failures).
  private resetTemporalSmoothing(postureType: PostureType): void {
    this.temporalScoreBuffers[postureType] = [];
    this.temporalConfidenceBuffers[postureType] = [];
    this.temporalLastUpdatedAt[postureType] = 0;
  }

  /**
   * Enhanced fallback when detection fails - Return zero score instead of random
   */
  private getEnhancedFallback(): HybridAnalysisResult {
    // NO PERSON DETECTED = ZERO SCORE
    return {
      success: false,
      overall_score: 0,
      posture_status: "No Person Detected",
      feedback: "Unable to analyze posture - no person detected in frame",
      confidence: 0,
      recommendations: [
        "Position yourself in front of the camera",
        "Ensure full body is visible in frame",
        "Check camera permissions and lighting",
      ],
      timestamp: new Date().toISOString(),
      source: "fallback",
      model_used: "offline-fallback",
      keypoints: [],
    };
  }

  /**
   * Pre-load model in background (call on app idle)
   */
  async preloadModel(): Promise<void> {
    if (!this.localModelLoaded && !this.modelLoadAttempted) {
      try {
        await this.initialize("nano");
      } catch (error) {
        console.warn("Background model preload failed:", error);
      }
    }
  }

  /**
   * Check if local models are available
   */
  async checkLocalModelsAvailable(): Promise<boolean> {
    try {
      const response = await fetch("/models/yolov8s-pose.onnx", {
        method: "HEAD",
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const hybridPostureService = new HybridPostureService();

// Export class for testing
export { HybridPostureService };
