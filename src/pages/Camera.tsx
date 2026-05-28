import { useState, useRef, useEffect, type TouchEvent } from "react";
import supabase from "../supabase";
import { useLoading } from "../contexts/LoadingContext";
import { useAudio } from "../contexts/AudioContext";
import toast from "react-hot-toast";
import { hybridPostureService } from "../services/hybridPostureService";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-cpu";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

// Ideal reference keypoints extracted from COCO dataset annotations
// Format: Your custom 17 keypoints - [Head, Neck, L/R Shoulder, L/R Elbow, L/R Hands, Hips, L/R Glute, L/R Knee, L/R Ankle, L/R Feet]
// Coordinates normalized and centered to fill the oval guide area properly
type IdealPoint = { x: number; y: number; confidence: number; name: string };

const IDEAL_MARCHING_LEFT: IdealPoint[] = [
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

const IDEAL_MARCHING_RIGHT: IdealPoint[] = [
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

const IDEAL_MARCHING_VARIANTS = [IDEAL_MARCHING_LEFT, IDEAL_MARCHING_RIGHT];

const IDEAL_KEYPOINTS: Record<string, IdealPoint[]> = {
  attention: [
    { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" }, // Head at top center
    { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" }, // Neck below head
    { x: 0.45, y: 0.25, confidence: 1.0, name: "Shoulder" }, // Left shoulder
    { x: 0.43, y: 0.38, confidence: 1.0, name: "Elbow" }, // Left elbow
    { x: 0.42, y: 0.52, confidence: 1.0, name: "Hands" }, // Left hand at side
    { x: 0.55, y: 0.25, confidence: 1.0, name: "Shoulder" }, // Right shoulder
    { x: 0.57, y: 0.38, confidence: 1.0, name: "Elbow" }, // Right elbow
    { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" }, // Hips center
    { x: 0.58, y: 0.52, confidence: 1.0, name: "Hands" }, // Right hand at side
    { x: 0.46, y: 0.5, confidence: 1.0, name: "Glute" }, // Left glute
    { x: 0.54, y: 0.5, confidence: 1.0, name: "Glute" }, // Right glute
    { x: 0.46, y: 0.65, confidence: 1.0, name: "Knee" }, // Left knee
    { x: 0.54, y: 0.65, confidence: 1.0, name: "Knee" }, // Right knee
    { x: 0.46, y: 0.82, confidence: 1.0, name: "Ankle" }, // Left ankle
    { x: 0.54, y: 0.82, confidence: 1.0, name: "Ankle" }, // Right ankle
    { x: 0.45, y: 0.9, confidence: 1.0, name: "Feet" }, // Left foot
    { x: 0.55, y: 0.9, confidence: 1.0, name: "Feet" }, // Right foot
  ],
  salutation: [
    { x: 0.5, y: 0.12, confidence: 1.0, name: "Head" }, // Head at top center
    { x: 0.5, y: 0.18, confidence: 1.0, name: "Neck" }, // Neck below head
    { x: 0.45, y: 0.25, confidence: 1.0, name: "Shoulder" }, // Left shoulder
    { x: 0.43, y: 0.38, confidence: 1.0, name: "Elbow" }, // Left elbow down
    { x: 0.42, y: 0.52, confidence: 1.0, name: "Hands" }, // Left hand at side
    { x: 0.57, y: 0.25, confidence: 1.0, name: "Shoulder" }, // Right shoulder
    { x: 0.65, y: 0.2, confidence: 1.0, name: "Elbow" }, // Right elbow raised (salute position)
    { x: 0.5, y: 0.48, confidence: 1.0, name: "Hips" }, // Hips center
    { x: 0.55, y: 0.13, confidence: 1.0, name: "Hands" }, // Right hand at forehead (SALUTE)
    { x: 0.46, y: 0.5, confidence: 1.0, name: "Glute" }, // Left glute
    { x: 0.54, y: 0.5, confidence: 1.0, name: "Glute" }, // Right glute
    { x: 0.46, y: 0.65, confidence: 1.0, name: "Knee" }, // Left knee
    { x: 0.54, y: 0.65, confidence: 1.0, name: "Knee" }, // Right knee
    { x: 0.46, y: 0.82, confidence: 1.0, name: "Ankle" }, // Left ankle
    { x: 0.54, y: 0.82, confidence: 1.0, name: "Ankle" }, // Right ankle
    { x: 0.45, y: 0.9, confidence: 1.0, name: "Feet" }, // Left foot
    { x: 0.55, y: 0.9, confidence: 1.0, name: "Feet" }, // Right foot
  ],
  marching: IDEAL_MARCHING_LEFT,
};

interface PostureType {
  title: string;
  instructions: string;
  checkpoints: string[];
}

interface ScanResult {
  success: boolean;
  score: number;
  feedback: string;
  posture?: string;
  confidence?: number;
  recommendations?: string[];
  timestamp?: string;
  image?: string;
}

interface CameraError {
  title: string;
  message: string;
  action: string;
}

interface PostureTypes {
  [key: string]: PostureType;
}

// Real-time posture correction feedback types
type CorrectionSeverity = "good" | "warning" | "error" | "fail";

interface BodyPartCorrection {
  bodyPart: string;
  icon: string;
  status: CorrectionSeverity;
  suggestion: string;
  deduction: number;
}

interface PostureScoreResult {
  score: number;
  passed: boolean;
  corrections: BodyPartCorrection[];
  /** Indices of keypoints belonging to body parts with errors */
  errorKeypointIndices: number[];
  /** Indices of keypoints belonging to body parts with warnings */
  warningKeypointIndices: number[];
}

// Live Railway API Configuration
const RAILWAY_API_URL = "https://model-cloud-production.up.railway.app";
const ESTIMATED_FOOT_EXTENSION = 0.18;
const PORTRAIT_ASPECT_RATIO = 9 / 16;

const getWeekStartMonday = (date: Date): Date => {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export default function Camera() {
  // Helper to map MoveNet (COCO) keypoints to your Custom Keypoints
  // --- 1. KEYPOINT MAPPING (Normalizes Pixels to 0-1) ---
  const mapMoveNetToCustom = (
    keypoints: poseDetection.Keypoint[],
    width: number,
    height: number,
  ) => {
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
    const midPoint = (p1: any, p2: any, name: string) => ({
      x: norm((p1.x + p2.x) / 2, width),
      y: norm((p1.y + p2.y) / 2, height),
      confidence: ((p1.score ?? 0) + (p2.score ?? 0)) / 2,
      name,
    });

    // Point creation helper
    const createPoint = (p: any, name: string) => ({
      x: norm(p.x, width),
      y: norm(p.y, height),
      confidence: p.score ?? 0,
      name,
    });

    const createFallbackPoint = (primary: any, fallback: any, name: string) =>
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
    const estimateFootPoint = (ankle: any, knee: any, name: string) => {
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
  };

  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  const tfBackendRef = useRef<string>("webgl");
  // --- 1. DEFINE MOVENET LOADER ---
  const loadMoveNet = async () => {
    try {
      const isMobileDevice =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      // Prefer WebGL, then gracefully fall back to CPU for mobile/browser compatibility.
      const backendCandidates = ["webgl", "cpu"] as const;
      let backendReady = false;
      let activeBackend = tf.getBackend();
      for (const backend of backendCandidates) {
        try {
          if (tf.getBackend() !== backend) {
            await tf.setBackend(backend);
          }
          await tf.ready();
          activeBackend = tf.getBackend();
          if (activeBackend === backend) {
            backendReady = true;
            break;
          }
        } catch (backendError) {
          console.warn(
            `⚠️ Failed to initialize TF backend: ${backend}`,
            backendError,
          );
        }
      }

      if (!backendReady) {
        throw new Error("No TensorFlow backend could be initialized");
      }
      tfBackendRef.current = activeBackend;

      // Create the detector
      const model = poseDetection.SupportedModels.MoveNet;

      const modelCandidates = isMobileDevice
        ? [
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          ]
        : [
            poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
            poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          ];

      let detectorLoaded = false;
      let lastDetectorError: unknown;

      for (const modelType of modelCandidates) {
        try {
          detectorRef.current = await poseDetection.createDetector(model, {
            modelType,
            enableSmoothing: true,
          });
          detectorLoaded = true;
          console.log(
            `✅ MoveNet loaded (${modelType}) on backend: ${tfBackendRef.current}`,
          );
          break;
        } catch (modelError) {
          lastDetectorError = modelError;
          console.warn(`⚠️ MoveNet model failed: ${modelType}`, modelError);
        }
      }

      if (!detectorLoaded) {
        throw (
          lastDetectorError ??
          new Error("Failed to initialize MoveNet detector")
        );
      }
    } catch (err) {
      console.error("❌ Failed to load MoveNet:", err);
      toast.error("Failed to load AI Model");
    }
  };

  // --- 2. DEFINE DETECTION LOOP ---
  const runDetection = async () => {
    if (
      !isRealTimeActiveRef.current ||
      !detectorRef.current ||
      !videoRef.current ||
      videoRef.current.readyState < 2
    ) {
      return;
    }

    try {
      const poses = await detectorRef.current.estimatePoses(videoRef.current);

      if (poses && poses.length > 0) {
        const rawKeypoints = poses[0].keypoints;
        const keypointConfidence =
          rawKeypoints.reduce((sum, kp) => sum + (kp.score ?? 0), 0) /
          Math.max(1, rawKeypoints.length);
        const confidence = Math.max(poses[0].score || 0, keypointConfidence);
        setLiveConfidence(confidence);

        const customKeypoints = mapMoveNetToCustom(
          rawKeypoints,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
        );

        const ideal =
          IDEAL_KEYPOINTS[currentPosture as keyof typeof IDEAL_KEYPOINTS] ||
          IDEAL_KEYPOINTS.salutation;
        const result: PostureScoreResult =
          currentPosture === "marching"
            ? IDEAL_MARCHING_VARIANTS.map((variant) =>
                calculateScore(
                  customKeypoints,
                  [...variant],
                  currentPosture,
                  rawKeypoints,
                ),
              ).reduce((best, cur) => (cur.score > best.score ? cur : best))
            : calculateScore(
                customKeypoints,
                ideal,
                currentPosture,
                rawKeypoints,
              );
        const visiblePointCount = customKeypoints.filter(
          (point) => point.confidence > 0.3,
        ).length;

        const now = Date.now();
        let displayScore: number;
        let displayPassed: boolean;
        let displayCorrections: BodyPartCorrection[];

        if (currentPosture === "marching") {
          // === MARCHING TEMPORAL SMOOTHING ===
          const buf = marchScoreBufferRef.current;
          buf.push(result.score);
          if (buf.length > MARCH_SCORE_BUFFER_SIZE) buf.shift();
          const sorted = [...buf].sort((a, b) => a - b);
          const median =
            sorted.length % 2 === 0
              ? Math.round(
                  (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) /
                    2,
                )
              : sorted[Math.floor(sorted.length / 2)];
          const feetCorrection = result.corrections.find(
            (c) => c.bodyPart === "Feet",
          );
          const hasValidStep =
            feetCorrection?.status === "good" ||
            feetCorrection?.status === "warning";
          if (hasValidStep) {
            marchLastGoodStepAtRef.current = now;
            marchConsecutiveBadRef.current = 0;
            marchLockedPassRef.current = true;
          } else {
            marchConsecutiveBadRef.current++;
          }
          const withinGrace =
            now - marchLastGoodStepAtRef.current < MARCH_GRACE_MS;
          const persistentBad =
            marchConsecutiveBadRef.current >= MARCH_BAD_FRAME_THRESHOLD;
          if (persistentBad && !withinGrace) {
            marchLockedPassRef.current = false;
          }
          displayScore = marchLockedPassRef.current
            ? Math.max(median, 75)
            : median;
          displayPassed = marchLockedPassRef.current || median >= 75;
          if (withinGrace && marchLockedPassRef.current) {
            displayCorrections = result.corrections.map((c) => {
              if (
                c.bodyPart === "Feet" &&
                (c.status === "error" || c.status === "fail")
              ) {
                return {
                  ...c,
                  status: "warning" as const,
                  suggestion: "Step transitioning...",
                  deduction: 0,
                };
              }
              return c;
            });
          } else {
            displayCorrections = result.corrections;
          }
          const prevS = smoothedScoreRef.current;
          const finalS =
            prevS === 0
              ? displayScore
              : Math.round(prevS * 0.6 + displayScore * 0.4);
          smoothedScoreRef.current = finalS;
          displayScore = finalS;
        } else {
          // === STATIC POSTURE SMOOTHING ===
          const prevS = smoothedScoreRef.current;
          displayScore =
            prevS === 0
              ? result.score
              : Math.round(
                  prevS * (1 - SCORE_EMA_ALPHA) +
                    result.score * SCORE_EMA_ALPHA,
                );
          smoothedScoreRef.current = displayScore;
          displayPassed = result.passed;
          displayCorrections = result.corrections;
        }

        setLiveScore(displayScore);
        setDetectedPosture(
          displayScore >= 75 && confidence > 0.5 && visiblePointCount >= 9
            ? "Good"
            : "Adjusting",
        );
        const correctionsJson = displayCorrections
          .map((c) => `${c.bodyPart}:${c.status}`)
          .join(",");
        if (
          correctionsJson !== lastCorrectionsJsonRef.current &&
          now - correctionsDebounceRef.current >
            (currentPosture === "marching" ? 600 : CORRECTIONS_DEBOUNCE_MS)
        ) {
          setLiveCorrections(displayCorrections);
          setLivePassed(displayPassed);
          lastCorrectionsJsonRef.current = correctionsJson;
          correctionsDebounceRef.current = now;
        }
        latestErrorKeypointsRef.current = result.errorKeypointIndices;
        latestWarningKeypointsRef.current = result.warningKeypointIndices;

        drawIdealPoseGuide();
        drawSkeleton(
          customKeypoints,
          result.score,
          canvasRef.current,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
          latestErrorKeypointsRef.current,
          latestWarningKeypointsRef.current,
        );
      } else {
        setDetectedPosture("No Pose");
        drawIdealPoseGuide();
      }
    } catch (error) {
      console.error("Detection error:", error);
    }

    if (isRealTimeActiveRef.current) {
      animationFrameRef.current = requestAnimationFrame(runDetection);
    }
  };

  const { showLoading, hideLoading, updateProgress } = useLoading();
  const {
    playButtonClick,
    playSuccess,
    playError,
    isMusicEnabled,
    toggleMusic,
  } = useAudio();

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [currentPosture, setCurrentPosture] = useState<string>("salutation");
  const [hasSelectedDrill, setHasSelectedDrill] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [cameraLoading, setCameraLoading] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraSectionRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanCountdown, setScanCountdown] = useState<number | null>(null);

  // Real-time detection states
  const [isRealTimeActive, setIsRealTimeActive] = useState<boolean>(false);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [detectedPosture, setDetectedPosture] = useState<string | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const [isSavingLiveResult, setIsSavingLiveResult] = useState<boolean>(false);
  // Real-time posture coaching state
  const [liveCorrections, setLiveCorrections] = useState<BodyPartCorrection[]>(
    [],
  );
  const [livePassed, setLivePassed] = useState<boolean>(false);
  const latestErrorKeypointsRef = useRef<number[]>([]);
  const latestWarningKeypointsRef = useRef<number[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRealTimeActiveRef = useRef<boolean>(false);
  // [TEMPORAL SMOOTHING] Reduce sensitivity / jitter in score & corrections
  const smoothedScoreRef = useRef<number>(0);
  const SCORE_EMA_ALPHA = 0.35;
  const lastCorrectionsJsonRef = useRef<string>("");
  const correctionsDebounceRef = useRef<number>(0);
  const CORRECTIONS_DEBOUNCE_MS = 400;
  // [MARCHING TEMPORAL TRACKING] Rolling buffer & state machine
  const MARCH_SCORE_BUFFER_SIZE = 8;
  const MARCH_BAD_FRAME_THRESHOLD = 4;
  const MARCH_GRACE_MS = 600;
  const marchScoreBufferRef = useRef<number[]>([]);
  const marchConsecutiveBadRef = useRef<number>(0);
  const marchLastGoodStepAtRef = useRef<number>(0);
  const marchLockedPassRef = useRef<boolean>(false);
  const scoreAnalysisBusyRef = useRef<boolean>(false);
  const lastScoreAnalysisAtRef = useRef<number>(0);
  const latestSkeletonKeypointsRef = useRef<any[]>([]);
  const latestOverlayScoreRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const consecutiveGoodFramesRef = useRef<number>(0);
  const autoSaveCountRef = useRef<number>(0);
  const MANUAL_LIVE_SAVE_COOLDOWN_MS = 5000;
  const LIVE_SAVE_REMINDER_MS = 25000;
  const lastManualSaveAtRef = useRef<number>(0);
  const lastLiveSaveReminderAtRef = useRef<number>(0);
  const lastStatsRefreshRef = useRef<number>(0);
  const STATS_REFRESH_INTERVAL = 30000; // Refresh aggregated stats at most every 30s
  const [apiStatus, setApiStatus] = useState<
    "checking" | "online" | "offline" | "local"
  >("checking");

  // Camera switching states
  const [currentCamera, setCurrentCamera] = useState<"front" | "back">("front");
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    [],
  );
  const [hasBackCamera, setHasBackCamera] = useState<boolean>(false);
  const [zoomSupported, setZoomSupported] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [zoomRange, setZoomRange] = useState<{
    min: number;
    max: number;
    step: number;
  }>({
    min: 1,
    max: 1,
    step: 0.1,
  });
  const zoomLevelRef = useRef<number>(1);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const lastPinchUpdateRef = useRef<number>(0);

  const hasCameraApi =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const isMobileBrowser =
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const canAttemptCameraSwitch = hasBackCamera || isMobileBrowser;

  const getCameraUnavailableMessage = (): CameraError => {
    const isInsecureContext =
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      !window.location.hostname.includes("localhost");

    if (isInsecureContext) {
      return {
        title: "Secure Camera Access Required",
        message:
          "This browser blocked camera access because the page is not secure. Open the app using HTTPS (or localhost) to use the camera on mobile.",
        action: "Open app with HTTPS URL",
      };
    }

    return {
      title: "Camera API Unavailable",
      message:
        "This browser or webview does not expose camera APIs for this page. Try Chrome/Edge and ensure camera permission is allowed.",
      action: "Try another browser and allow camera",
    };
  };

  const postureTypes: PostureTypes = {
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

  // Function to check API status - test the actual analyze endpoint
  const checkApiStatus = async () => {
    try {
      console.log("🔍 Checking system status...");

      // Check if local models are available
      const status = hybridPostureService.getStatus();

      if (status.localReady) {
        setApiStatus("local");
        console.log("✅ Local models available - offline mode ready");
        return;
      }

      // First try a simple GET request to check if the server is responsive
      const healthResponse = await fetch(`${RAILWAY_API_URL}/`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        console.log("✅ Railway server is responsive");

        // Now test the actual analyze endpoint
        const response = await fetch(`${RAILWAY_API_URL}/analyze_base64`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image:
              "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
            posture_type: "salutation",
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (response.ok || response.status === 422 || response.status === 400) {
          setApiStatus("online");
          console.log("✅ Railway API analyze endpoint is working");
        } else {
          setApiStatus("offline");
          console.log(
            `⚠️ Railway API analyze endpoint responded with status: ${response.status}`,
          );
        }
      } else {
        setApiStatus("offline");
        console.log(
          `❌ Railway server not responsive: ${healthResponse.status}`,
        );
      }
    } catch (error) {
      setApiStatus("offline");
      if (error instanceof Error) {
        console.log("❌ Railway API connection failed:", error.message);
      } else {
        console.log("❌ Railway API connection failed:", error);
      }
    }
  };

  // Function to fetch weekly statistics
  const fetchWeeklyStats = async (showLoadingIndicator: boolean = false) => {
    try {
      if (showLoadingIndicator) {
        showLoading("📊 STATS UPDATE", "Loading weekly statistics...", {
          showProgress: true,
          progress: 0,
        });
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        if (showLoadingIndicator) hideLoading();
        return;
      }

      if (showLoadingIndicator) updateProgress(25);

      // Calculate weekly stats from scan_history directly to avoid table issues
      const weekStart = getWeekStartMonday(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      if (showLoadingIndicator) updateProgress(50);

      const { data: scanData, error } = await supabase
        .from("scan_history")
        .select("score, success")
        .eq("user_id", session.user.id)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      if (error) {
        console.error("Error fetching weekly stats from scan_history:", error);
        if (showLoadingIndicator) hideLoading();
        return;
      }

      if (showLoadingIndicator) updateProgress(75);

      const totalScans = scanData?.length || 0;
      const averageScore =
        totalScans > 0
          ? scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans
          : 0;

      if (showLoadingIndicator) {
        updateProgress(100);
        // Brief delay to show completion
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Show success toast for manual stats refresh
        toast.success(
          `📊 Stats updated! ${totalScans} scans this week (${averageScore.toFixed(1)}% avg)`,
          {
            icon: "📈",
          },
        );
      }
    } catch (error) {
      console.error("Error in fetchWeeklyStats:", error);
      if (showLoadingIndicator) {
        toast.error("❌ Failed to load weekly statistics");
      }
    } finally {
      if (showLoadingIndicator) hideLoading();
    }
  };

  // Function to update weekly progress manually
  const updateWeeklyProgress = async (userId: string) => {
    try {
      const weekStart = getWeekStartMonday(new Date());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const { data: weekScans, error: statsError } = await supabase
        .from("scan_history")
        .select("score, success")
        .eq("user_id", userId)
        .gte("created_at", weekStart.toISOString())
        .lte("created_at", weekEnd.toISOString());

      if (statsError) {
        console.error("Error fetching week stats:", statsError);
        return;
      }

      const totalScans = weekScans?.length || 0;
      const successfulScans =
        weekScans?.filter((scan) => scan.success).length || 0;
      const averageScore =
        totalScans > 0
          ? weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans
          : 0;

      // Now actually update the weekly_progress table
      const { data: existingProgress, error: checkError } = await supabase
        .from("weekly_progress")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start_date", weekStart.toISOString().split("T")[0])
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 = no rows found
        console.error("Error checking existing weekly progress:", checkError);
        return;
      }

      const progressData = {
        user_id: userId,
        week_start_date: weekStart.toISOString().split("T")[0],
        week_end_date: weekEnd.toISOString().split("T")[0],
        total_scans: totalScans,
        successful_scans: successfulScans,
        average_score: Number(averageScore.toFixed(2)),
        updated_at: new Date().toISOString(),
      };

      if (existingProgress) {
        // Update existing record
        const { error: updateError } = await supabase
          .from("weekly_progress")
          .update(progressData)
          .eq("user_id", userId)
          .eq("week_start_date", weekStart.toISOString().split("T")[0]);

        if (updateError) {
          console.error("Error updating weekly progress:", updateError);
        } else {
          console.log("✅ Weekly progress updated successfully:", progressData);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from("weekly_progress")
          .insert([progressData]);

        if (insertError) {
          console.error("Error inserting weekly progress:", insertError);
        } else {
          console.log(
            "✅ Weekly progress inserted successfully:",
            progressData,
          );
        }
      }

      console.log("Weekly stats calculated:", {
        totalScans,
        successfulScans,
        averageScore: Number(averageScore.toFixed(2)),
      });
    } catch (error) {
      console.error("Error in updateWeeklyProgress:", error);
    }
  };

  // Function to aggregate all previous weeks for a user
  const aggregateAllWeeklyProgress = async (userId: string) => {
    try {
      console.log("🔄 Starting weekly progress aggregation for user:", userId);

      // Get the earliest scan date for this user
      const { data: earliestScan, error: earliestError } = await supabase
        .from("scan_history")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (earliestError || !earliestScan) {
        console.log("No scan history found for user");
        return;
      }

      const earliestDate = new Date(earliestScan.created_at);
      const currentDate = new Date();

      // Calculate all weeks from earliest scan to current week
      const weeks = [];
      let weekStart = getWeekStartMonday(earliestDate);

      while (weekStart <= currentDate) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
        });

        weekStart.setDate(weekStart.getDate() + 7); // Next week
      }

      console.log(`📊 Processing ${weeks.length} weeks for aggregation`);

      // Process each week
      for (const week of weeks) {
        const { data: weekScans, error: scansError } = await supabase
          .from("scan_history")
          .select("score, success")
          .eq("user_id", userId)
          .gte("created_at", week.start.toISOString())
          .lte("created_at", week.end.toISOString());

        if (scansError) {
          console.error(
            "Error fetching scans for week:",
            week.start,
            scansError,
          );
          continue;
        }

        const totalScans = weekScans?.length || 0;

        // Skip weeks with no scans
        if (totalScans === 0) continue;

        const successfulScans =
          weekScans?.filter((scan) => scan.success).length || 0;
        const averageScore =
          weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans;

        // Check if this week already exists in weekly_progress
        const { data: existingWeek, error: checkError } = await supabase
          .from("weekly_progress")
          .select("*")
          .eq("user_id", userId)
          .eq("week_start_date", week.start.toISOString().split("T")[0])
          .single();

        if (checkError && checkError.code !== "PGRST116") {
          console.error("Error checking existing week:", checkError);
          continue;
        }

        const weekData = {
          user_id: userId,
          week_start_date: week.start.toISOString().split("T")[0],
          week_end_date: week.end.toISOString().split("T")[0],
          total_scans: totalScans,
          successful_scans: successfulScans,
          average_score: Number(averageScore.toFixed(2)),
          updated_at: new Date().toISOString(),
        };

        if (existingWeek) {
          // Update existing record
          const { error: updateError } = await supabase
            .from("weekly_progress")
            .update(weekData)
            .eq("user_id", userId)
            .eq("week_start_date", week.start.toISOString().split("T")[0]);

          if (updateError) {
            console.error("Error updating week:", week.start, updateError);
          } else {
            console.log(
              `✅ Updated week ${week.start.toISOString().split("T")[0]}:`,
              weekData,
            );
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from("weekly_progress")
            .insert([weekData]);

          if (insertError) {
            console.error("Error inserting week:", week.start, insertError);
          } else {
            console.log(
              `✅ Inserted week ${week.start.toISOString().split("T")[0]}:`,
              weekData,
            );
          }
        }
      }

      console.log("🎉 Weekly progress aggregation completed");
    } catch (error) {
      console.error("Error in aggregateAllWeeklyProgress:", error);
    }
  };

  // Function to check if weekly aggregation should run
  const checkAndRunWeeklyAggregation = async (userId: string) => {
    try {
      const lastRunKey = `weekly_aggregation_last_run_${userId}`;
      const lastRun = localStorage.getItem(lastRunKey);
      const currentWeekStart = getWeekStartMonday(new Date());

      let shouldRun = false;

      if (!lastRun) {
        // Never run before - run full aggregation
        shouldRun = true;
        console.log("📅 First time running weekly aggregation");
      } else {
        const lastRunDate = new Date(lastRun);
        const lastRunWeekStart = getWeekStartMonday(lastRunDate);

        // Check if we're in a new week
        if (currentWeekStart.getTime() > lastRunWeekStart.getTime()) {
          shouldRun = true;
          console.log("📅 New week detected, running weekly aggregation");
        }
      }

      if (shouldRun) {
        await aggregateAllWeeklyProgress(userId);
        localStorage.setItem(lastRunKey, new Date().toISOString());
      } else {
        console.log("📅 Weekly aggregation not needed yet");
      }
    } catch (error) {
      console.error("Error in checkAndRunWeeklyAggregation:", error);
    }
  };

  // --- 4. INITIALIZATION EFFECT ---
  useEffect(() => {
    if (!hasSelectedDrill) return;

    const initializeCamera = async () => {
      showLoading("🏗️ INITIALIZING SYSTEM", "Loading posture AI & Camera...", {
        showProgress: true,
        progress: 0,
      });

      try {
        updateProgress(20);

        // [SKELETON VISUALIZATION] Keep MoveNet loaded for live skeleton overlay.
        console.log("🔄 Initializing MoveNet skeleton visualizer...");
        await loadMoveNet();

        // [SCORING UPGRADE] Hybrid/local scorer remains the source of score/save logic.
        console.log("🔄 Initializing hybrid/local posture scorer...");
        // [DETECTION FIX] Load ONNX posture model before any real-time analysis.
        // Without this, hybrid service returns fallback (0% / no person detected).
        await hybridPostureService.initialize("nano");

        updateProgress(50);
        const cameraInfo = await detectCameras();

        updateProgress(70);
        const initialCamera =
          isMobileBrowser && cameraInfo.hasBackCamera ? "back" : "front";
        setCurrentCamera(initialCamera);
        await startCamera(initialCamera);

        // Optional: Keep stats fetching if you still use it
        updateProgress(85);
        await fetchWeeklyStats();

        updateProgress(92);
        await checkApiStatus();

        updateProgress(100);

        // Brief delay to show completion
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Error during camera initialization:", error);
      } finally {
        hideLoading();
      }
    };

    initializeCamera();

    // Ensure music is playing (trigger user interaction)
    const ensureMusic = () => {
      if (!isMusicEnabled) {
        toggleMusic();
      }
    };

    const handleInteraction = () => {
      ensureMusic();
      document.removeEventListener("click", handleInteraction);
    };
    document.addEventListener("click", handleInteraction);

    return () => {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track: MediaStreamTrack) => track.stop());
        streamRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, [hasSelectedDrill]);

  // Weekly aggregation effect - runs when component mounts and checks for user session
  useEffect(() => {
    const runWeeklyAggregationCheck = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          console.log("🗓️ Checking if weekly aggregation is needed...");
          await checkAndRunWeeklyAggregation(session.user.id);
        }
      } catch (error) {
        console.error("Error in weekly aggregation check:", error);
      }
    };

    runWeeklyAggregationCheck();

    // Also set up a daily check (every 24 hours) for ongoing aggregation
    const dailyAggregationCheck = setInterval(
      runWeeklyAggregationCheck,
      24 * 60 * 60 * 1000,
    );

    return () => {
      clearInterval(dailyAggregationCheck);
    };
  }, []);

  // Handle scan trigger when countdown completes
  useEffect(() => {
    if (scanCountdown === 0) {
      handleScan();
      setScanCountdown(null); // Reset to prevent multiple triggers
    }
  }, [scanCountdown]); // handleScan is stable, can omit from deps

  // Handle loading state when scanning starts
  useEffect(() => {
    if (isScanning) {
      showLoading(
        "🎯 TACTICAL SCAN IN PROGRESS...",
        "Capturing image data...",
        { showProgress: true, progress: 0 },
      );
    }
  }, [isScanning, showLoading]);

  // Show ideal pose guide when posture changes or when not detecting
  useEffect(() => {
    const showGuide = () => {
      if (
        !isRealTimeActive &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        setTimeout(() => drawIdealPoseGuide(), 200);
      }
    };

    showGuide();

    // Also show guide when video metadata loads
    const video = videoRef.current;
    if (video) {
      video.addEventListener("loadedmetadata", showGuide);
      return () => video.removeEventListener("loadedmetadata", showGuide);
    }
  }, [currentPosture, isRealTimeActive]);

  // Function to detect available cameras
  const detectCameras = async (): Promise<{ hasBackCamera: boolean }> => {
    try {
      if (!hasCameraApi) {
        const unavailableError = getCameraUnavailableMessage();
        setCameraError(unavailableError);
        setHasBackCamera(false);
        setAvailableCameras([]);
        return { hasBackCamera: false };
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );
      setAvailableCameras(videoDevices);

      // Check if there's a back camera
      const backCamera = videoDevices.find(
        (device) =>
          device.label.toLowerCase().includes("back") ||
          device.label.toLowerCase().includes("rear") ||
          device.label.toLowerCase().includes("environment"),
      );

      const hasBackDetected = !!backCamera || videoDevices.length > 1;
      setHasBackCamera(hasBackDetected);
      console.log("📷 Available cameras:", videoDevices.length);
      console.log("📷 Back camera detected:", hasBackDetected);
      return { hasBackCamera: hasBackDetected };
    } catch (error) {
      console.error("Error detecting cameras:", error);
      return { hasBackCamera: false };
    }
  };

  // Function to switch camera
  const switchCamera = async () => {
    playButtonClick();
    showLoading("📹 CAMERA SWITCH", "Switching camera view...", {
      showProgress: true,
      progress: 0,
    });

    const newCamera = currentCamera === "front" ? "back" : "front";
    setCurrentCamera(newCamera);
    console.log("🔄 Switching to", newCamera, "camera");

    updateProgress(50);

    try {
      await startCamera(newCamera);
      updateProgress(100);

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Show success toast
      playSuccess();
      toast.success(`📹 Camera switched to ${newCamera} view!`, {
        icon: newCamera === "front" ? "🤳" : "📷",
      });
    } catch (error) {
      console.error("Error switching camera:", error);
      playError();
      toast.error("❌ Failed to switch camera. Please try again.");
    } finally {
      hideLoading();
    }
  };

  const initializeZoomControls = (videoTrack: MediaStreamTrack) => {
    const capabilities =
      (videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
        zoom?: { min?: number; max?: number; step?: number };
      }) || { zoom: undefined };

    if (
      capabilities.zoom &&
      typeof capabilities.zoom.min === "number" &&
      typeof capabilities.zoom.max === "number"
    ) {
      const min = capabilities.zoom.min;
      const max = capabilities.zoom.max;
      const step =
        typeof capabilities.zoom.step === "number" && capabilities.zoom.step > 0
          ? capabilities.zoom.step
          : 0.1;
      const settings = videoTrack.getSettings() as MediaTrackSettings & {
        zoom?: number;
      };
      const currentZoom =
        typeof settings.zoom === "number" ? settings.zoom : min > 0 ? min : 1;

      setZoomSupported(true);
      setZoomRange({ min, max, step });
      setZoomLevel(Math.max(min, Math.min(max, currentZoom)));
    } else {
      setZoomSupported(false);
      setZoomRange({ min: 1, max: 1, step: 0.1 });
      setZoomLevel(1);
    }
  };

  const applyZoom = async (requestedZoom: number) => {
    if (!streamRef.current || !zoomSupported) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const clampedZoom = Math.max(
      zoomRange.min,
      Math.min(zoomRange.max, requestedZoom),
    );

    try {
      await videoTrack.applyConstraints({
        advanced: [{ zoom: clampedZoom } as MediaTrackConstraintSet],
      });
      setZoomLevel(clampedZoom);
    } catch (error) {
      console.warn("Zoom adjustment failed:", error);
      setZoomSupported(false);
      toast.error("Zoom adjustment is not supported on this device.");
    }
  };

  useEffect(() => {
    zoomLevelRef.current = zoomLevel;
  }, [zoomLevel]);

  const getTouchDistance = (
    touches: TouchEvent<HTMLDivElement>["touches"],
  ): number => {
    if (touches.length < 2) return 0;
    const [firstTouch, secondTouch] = [touches[0], touches[1]];
    const dx = secondTouch.clientX - firstTouch.clientX;
    const dy = secondTouch.clientY - firstTouch.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleCameraTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (!zoomSupported || event.touches.length < 2) return;
    pinchDistanceRef.current = getTouchDistance(event.touches);
    pinchStartZoomRef.current = zoomLevelRef.current;
    event.preventDefault();
  };

  const handleCameraTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (
      !zoomSupported ||
      event.touches.length < 2 ||
      !pinchDistanceRef.current
    ) {
      return;
    }

    const currentDistance = getTouchDistance(event.touches);
    if (currentDistance <= 0) return;

    const now = Date.now();
    if (now - lastPinchUpdateRef.current < 50) return;
    lastPinchUpdateRef.current = now;

    const distanceRatio = currentDistance / pinchDistanceRef.current;
    const nextZoom = pinchStartZoomRef.current * distanceRatio;
    const zoomDelta = Math.abs(nextZoom - zoomLevelRef.current);
    if (zoomDelta >= Math.max(zoomRange.step / 2, 0.02)) {
      void applyZoom(nextZoom);
    }
    event.preventDefault();
  };

  const handleCameraTouchEnd = () => {
    pinchDistanceRef.current = null;
    pinchStartZoomRef.current = zoomLevelRef.current;
  };

  const startCamera = async (
    cameraType: "front" | "back" = "front",
  ): Promise<void> => {
    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track: MediaStreamTrack) => track.stop());
    }

    try {
      setCameraLoading(true);
      setCameraError(null);

      if (!hasCameraApi) {
        setCameraError(getCameraUnavailableMessage());
        setCameraLoading(false);
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );

      if (videoDevices.length === 0) {
        setCameraError({
          title: "No Camera Found",
          message: "No camera devices detected on this device.",
          action: "Connect a camera and refresh",
        });
        return;
      }

      // Determine camera constraints based on type - allow natural camera resolution
      const prefersPortrait = isMobileBrowser;
      let videoConstraints: MediaTrackConstraints = {
        width: prefersPortrait
          ? { min: 360, ideal: 1080, max: 1920 }
          : { min: 320, ideal: 1280, max: 1920 },
        height: prefersPortrait
          ? { min: 640, ideal: 1920, max: 2560 }
          : { min: 240, ideal: 720, max: 1080 },
        aspectRatio: prefersPortrait
          ? {
              min: PORTRAIT_ASPECT_RATIO - 0.02,
              ideal: PORTRAIT_ASPECT_RATIO,
              max: PORTRAIT_ASPECT_RATIO + 0.02,
            }
          : undefined,
        frameRate: prefersPortrait ? { ideal: 24, max: 30 } : { ideal: 30 },
      };

      if (cameraType === "front") {
        videoConstraints.facingMode = "user";
      } else {
        // Try environment (back) camera first, fallback to any available camera
        try {
          videoConstraints.facingMode = { exact: "environment" };
        } catch {
          // If exact environment fails, try ideal
          videoConstraints.facingMode = { ideal: "environment" };
        }
      }

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
        });
      } catch (error) {
        // Fallback: if specific camera fails, try any camera
        console.warn("Specific camera failed, trying fallback:", error);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: prefersPortrait ? { ideal: 1080 } : { ideal: 1280 },
            height: prefersPortrait ? { ideal: 1920 } : { ideal: 720 },
            aspectRatio: {
              min: PORTRAIT_ASPECT_RATIO - 0.02,
              ideal: PORTRAIT_ASPECT_RATIO,
              max: PORTRAIT_ASPECT_RATIO + 0.02,
            },
            frameRate: prefersPortrait ? { ideal: 24, max: 30 } : { ideal: 30 },
            facingMode:
              cameraType === "front" ? "user" : { ideal: "environment" },
          },
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setCameraLoading(false);
          // Update current camera state based on actual stream
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          if (settings.facingMode) {
            setCurrentCamera(settings.facingMode === "user" ? "front" : "back");
          }
          // Re-check devices after permission is granted. Some mobile browsers
          // only expose complete camera info after an active stream exists.
          void detectCameras();
          initializeZoomControls(videoTrack);
        };
      }
    } catch (error: unknown) {
      console.error("Camera access error:", error);

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          setCameraError({
            title: "Camera Access Denied",
            message:
              "Camera permission was denied. Please allow camera access to use the scanner.",
            action: "Allow camera access in browser settings",
          });
        } else {
          setCameraError({
            title: "Camera Error",
            message: `Unable to access camera: ${error.message}`,
            action: "Check camera connection and try again",
          });
        }
      } else {
        setCameraError({
          title: "Unknown Error",
          message: "An unknown error occurred while accessing the camera.",
          action: "Refresh the page and try again",
        });
      }
      setCameraLoading(false);
    }
  };

  const captureImage = (): string | null => {
    console.log("📸 Capturing image at:", new Date().toLocaleTimeString());
    if (!videoRef.current) return null;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return null;

    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    context.drawImage(videoRef.current, 0, 0);
    return canvas.toDataURL("image/jpeg");
  };

  // Draw ideal reference pose as guide overlay (shown BEFORE/DURING detection)
  const drawIdealPoseGuide = () => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render in display pixels (with DPR scaling) so lines stay visible on mobile.
    const displayWidth = Math.max(
      1,
      Math.round(canvas.clientWidth || video.clientWidth || video.videoWidth),
    );
    const displayHeight = Math.max(
      1,
      Math.round(
        canvas.clientHeight || video.clientHeight || video.videoHeight,
      ),
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
  };

  // Start/stop real-time detection
  const toggleRealTimeDetection = async () => {
    playButtonClick();

    if (isRealTimeActive) {
      // Stop real-time detection
      console.log("🛑 STOPPING real-time detection...");

      // Update ref FIRST to stop async operations immediately
      isRealTimeActiveRef.current = false;
      setIsRealTimeActive(false);

      // Clear all scheduled callbacks
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setLiveScore(null);
      setDetectedPosture(null);
      setLiveConfidence(null);
      latestSkeletonKeypointsRef.current = [];
      latestOverlayScoreRef.current = 0;
      scoreAnalysisBusyRef.current = false;
      lastScoreAnalysisAtRef.current = 0;
      consecutiveGoodFramesRef.current = 0;
      autoSaveCountRef.current = 0;
      // Reset marching temporal state
      marchScoreBufferRef.current = [];
      marchConsecutiveBadRef.current = 0;
      marchLastGoodStepAtRef.current = 0;
      marchLockedPassRef.current = false;
      smoothedScoreRef.current = 0;

      // Show ideal pose guide when detection stops
      setTimeout(() => drawIdealPoseGuide(), 100);

      console.log("✅ Real-time detection STOPPED");
    } else {
      // Start real-time detection
      console.log("▶️ STARTING real-time detection...");

      // [SKELETON VISUALIZATION] Ensure MoveNet is available each time
      // the cadet starts real-time mode (recovery after hot-reload/dispose).
      if (!detectorRef.current) {
        await loadMoveNet();
      }

      playSuccess();

      // Update ref FIRST before starting
      isRealTimeActiveRef.current = true;
      setIsRealTimeActive(true);
      lastSaveTimeRef.current = 0; // Reset save timer
      latestSkeletonKeypointsRef.current = [];
      latestOverlayScoreRef.current = 0;
      scoreAnalysisBusyRef.current = false;
      lastScoreAnalysisAtRef.current = 0;
      consecutiveGoodFramesRef.current = 0;
      // Reset marching temporal state on start
      marchScoreBufferRef.current = [];
      marchConsecutiveBadRef.current = 0;
      marchLastGoodStepAtRef.current = 0;
      marchLockedPassRef.current = false;
      smoothedScoreRef.current = 0;
      autoSaveCountRef.current = 0;
      lastStatsRefreshRef.current = 0;
      console.log("✅ Real-time detection STARTED");
    }
  };

  // Save posture result to database
  const savePostureResult = async (result: any, postureType: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log("No user session, skipping save");
        return;
      }

      const { error: scanError } = await supabase.from("scan_history").insert([
        {
          user_id: session.user.id,
          posture_type: postureType,
          score: result.overall_score,
          success: result.success,
          feedback: result.feedback,
        },
      ]);

      if (scanError) {
        console.error("Error saving scan result:", scanError);
      } else {
        console.log("✅ Posture result saved to database");
        // Throttle expensive aggregate refresh to reduce UI lag.
        const now = Date.now();
        if (now - lastStatsRefreshRef.current >= STATS_REFRESH_INTERVAL) {
          await updateWeeklyProgress(session.user.id);
          await fetchWeeklyStats();
          lastStatsRefreshRef.current = now;
        }
      }
    } catch (error) {
      console.error("Error in savePostureResult:", error);
    }
  };

  const handleManualLiveSave = async () => {
    if (isSavingLiveResult) return;

    if (!isRealTimeActive || liveScore === null) {
      toast.error("Start live detection first before saving a result.");
      return;
    }

    const now = Date.now();
    if (now - lastManualSaveAtRef.current < MANUAL_LIVE_SAVE_COOLDOWN_MS) {
      toast("Please wait a few seconds before saving again.", { icon: "⏱️" });
      return;
    }

    try {
      setIsSavingLiveResult(true);
      await savePostureResult(
        {
          overall_score: liveScore,
          success: liveScore >= 75,
          feedback: `Manual live save (${detectedPosture ?? "In progress"})`,
          confidence: liveConfidence ?? 0,
        },
        currentPosture,
      );

      lastManualSaveAtRef.current = now;
      lastLiveSaveReminderAtRef.current = now;
      playSuccess();
      toast.success(
        `💾 Saved ${currentPosture.toUpperCase()} result (${liveScore}%)`,
      );
    } catch (error) {
      console.error("Error in handleManualLiveSave:", error);
      toast.error("Failed to save live result.");
    } finally {
      setIsSavingLiveResult(false);
    }
  };

  // Effect to manage real-time detection lifecycle
  useEffect(() => {
    // Sync ref with state
    isRealTimeActiveRef.current = isRealTimeActive;

    if (isRealTimeActive) {
      // [SCORING UPGRADE] Keep one live scoring loop active.
      runDetection();
    }

    return () => {
      // Cleanup on unmount or when switching postures
      isRealTimeActiveRef.current = false;
      consecutiveGoodFramesRef.current = 0;
      autoSaveCountRef.current = 0;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isRealTimeActive, currentPosture]);

  useEffect(() => {
    if (!isRealTimeActive || liveScore === null) return;

    const now = Date.now();
    if (now - lastLiveSaveReminderAtRef.current >= LIVE_SAVE_REMINDER_MS) {
      toast("Tap Save Result to record weekly stats.", {
        icon: "💾",
        duration: 2500,
      });
      lastLiveSaveReminderAtRef.current = now;
    }
  }, [isRealTimeActive, liveScore]);

  const handleScan = async (): Promise<void> => {
    const scanId = Date.now();
    console.log(`🎯 Starting scan #${scanId}`);

    // Prevent multiple simultaneous scans
    if (isScanning) {
      console.log(`🚫 Scan #${scanId} blocked - scan already in progress`);
      return;
    }

    setIsScanning(true);

    const imageData = captureImage();

    if (!imageData) {
      setScanResult({
        success: false,
        score: 0,
        feedback: "Failed to capture image",
      });
      setIsScanning(false);
      hideLoading();
      return;
    }

    updateProgress(25);

    try {
      const response = await fetch(imageData);
      const blob = await response.blob();

      // Convert blob to base64 for the new workflow API
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });

      updateProgress(50);

      // Use Hybrid Posture Service (Local Models → API → Fallback)
      let scanResult;

      console.log(
        "🚀 Analyzing posture with hybrid service... (SCAN ID:",
        Date.now(),
        ")",
      );

      try {
        const hybridResult = await hybridPostureService.analyzePosture(
          base64Data,
          currentPosture as "salutation" | "marching" | "attention",
        );

        updateProgress(75);

        // Log actual model score
        console.log(
          `✅ Scan complete | Score: ${hybridResult.overall_score}% | Source: ${hybridResult.source} | Model: ${hybridResult.model_used} | Confidence: ${(hybridResult.confidence * 100).toFixed(0)}%`,
        );

        scanResult = {
          success: hybridResult.success,
          score: hybridResult.overall_score,
          feedback:
            hybridResult.feedback +
            ` [${hybridResult.source === "local" ? "📱 Local AI" : hybridResult.source === "api" ? "☁️ Cloud API" : "🔄 Offline"}]`,
          posture: currentPosture,
          confidence: hybridResult.confidence,
          recommendations: hybridResult.recommendations,
          timestamp: hybridResult.timestamp,
          image: imageData,
        };
      } catch (error) {
        console.error("❌ Hybrid service failed completely:", error);

        updateProgress(60);

        // Return zero score when everything fails
        scanResult = {
          success: false,
          score: 0,
          feedback: `Unable to analyze posture - detection failed [⚠️ Error]`,
          posture: currentPosture,
          confidence: 0,
          recommendations: [
            "Check camera permissions",
            "Ensure good lighting",
            "Position full body in frame",
            "Try again",
          ],
          timestamp: new Date().toISOString(),
          image: imageData,
        };

        console.log("❌ Detection failed, returning zero score");
      }

      updateProgress(85);

      setScanResult(scanResult);

      // Show toast notification based on scan result
      if (scanResult.success) {
        toast.success(`🎯 EXCELLENT POSTURE! Score: ${scanResult.score}%`, {
          duration: 5000,
          icon: "🏆",
        });
      } else {
        toast.error(
          `📊 Posture needs improvement. Score: ${scanResult.score}%`,
          {
            duration: 5000,
            icon: "💪",
          },
        );
      }

      // Save scan result to database - this will trigger weekly_progress update automatically
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user && scanResult) {
          const { error: scanError } = await supabase
            .from("scan_history")
            .insert([
              {
                user_id: session.user.id,
                posture_type: currentPosture,
                score: scanResult.score,
                success: scanResult.success,
                feedback: scanResult.feedback,
              },
            ]);

          if (scanError) {
            console.error("Error saving scan result:", scanError);
            toast.error("⚠️ Scan completed but failed to save to history", {
              duration: 4000,
            });
            setScanResult({
              ...scanResult,
              feedback:
                scanResult.feedback + " (Note: Result not saved to history)",
            });
          } else {
            console.log(
              "Scan result saved successfully to scan_history and weekly_progress updated automatically",
            );
            updateProgress(95);
            await updateWeeklyProgress(session.user.id);
            await fetchWeeklyStats();

            // Show database save success (only for successful scans to avoid spam)
            if (scanResult.success) {
              setTimeout(() => {
                toast.success("💾 Scan result saved to history!", {
                  duration: 3000,
                  icon: "✅",
                });
              }, 1000); // Delay to not interfere with main scan result toast
            }
          }
        }
      } catch (dbError) {
        console.error("Error saving scan result:", dbError);
        toast.error(
          "🔌 Database connection error. Scan completed but not saved.",
          {
            duration: 5000,
          },
        );
        if (scanResult) {
          setScanResult({
            ...scanResult,
            feedback:
              scanResult.feedback + " (Note: Result not saved to history)",
          });
        }
      }

      updateProgress(100);

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error in handleScan:", error);
      setScanResult({
        success: false,
        score: 0,
        feedback: "Error during scanning process",
        posture: currentPosture,
      });
    } finally {
      console.log(`✅ Scan completed, setting isScanning to false`);
      setIsScanning(false);
      hideLoading();
    }
  };

  // Legacy countdown scan function (kept for potential future use)
  // const handleScanWithCountdown = () => {
  //   if (isScanning || scanCountdown !== null) {
  //     console.log('🚫 Scan or countdown already in progress, ignoring...')
  //     return
  //   }
  //   setScanCountdown(5)
  //   setScanResult(null)
  //   const countdown = setInterval(() => {
  //     setScanCountdown((prev) => {
  //       if (prev === null || prev <= 1) {
  //         clearInterval(countdown)
  //         return 0
  //       }
  //       return prev - 1
  //     })
  //   }, 1000)
  // }

  const resetScan = () => {
    setScanResult(null);
    setScanCountdown(null);
  };

  const retryCamera = () => {
    setCameraError(null);
    startCamera(currentCamera);
  };

  const focusCameraSection = () => {
    const cameraSection = cameraSectionRef.current;
    if (!cameraSection) return;

    requestAnimationFrame(() => {
      cameraSection.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleExitToDrillSelection = () => {
    playButtonClick();

    isRealTimeActiveRef.current = false;
    setIsRealTimeActive(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setLiveScore(null);
    setDetectedPosture(null);
    setLiveConfidence(null);
    setScanResult(null);
    setScanCountdown(null);
    consecutiveGoodFramesRef.current = 0;
    autoSaveCountRef.current = 0;

    setHasSelectedDrill(false);
  };

  const handleSelectDrill = (drillKey: string) => {
    playButtonClick();
    setHasSelectedDrill(true);
    setCurrentPosture(drillKey);
    consecutiveGoodFramesRef.current = 0;
    focusCameraSection();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col pb-28">
      {!hasSelectedDrill && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-2xl shadow-emerald-500/20 flex-shrink-0">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      apiStatus === "local"
                        ? "bg-purple-400 animate-pulse"
                        : apiStatus === "online"
                          ? "bg-green-400 animate-pulse"
                          : apiStatus === "offline"
                            ? "bg-red-400"
                            : "bg-yellow-400 animate-pulse"
                    }`}
                  ></div>
                  <span className="text-xs text-emerald-100">
                    {apiStatus === "local"
                      ? "📱 Local AI"
                      : apiStatus === "online"
                        ? "API Online"
                        : apiStatus === "offline"
                          ? "Offline Mode"
                          : "Checking..."}
                  </span>
                </div>

                {/* Music Toggle Button */}
                <button
                  onClick={() => {
                    playButtonClick();
                    toggleMusic();
                  }}
                  className="w-10 h-10 bg-emerald-800/50 hover:bg-emerald-700/50 rounded-lg flex items-center justify-center transition-all duration-200 border border-emerald-600/30 hover:border-emerald-500"
                  title={isMusicEnabled ? "Music On" : "Music Off"}
                >
                  <span className="text-xl">
                    {isMusicEnabled ? "🔊" : "🔇"}
                  </span>
                </button>

                {/* Camera Tips */}
                <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-900/30 border border-blue-500/20">
                  <span className="text-blue-400 text-xs">💡</span>
                  <span className="text-blue-200 text-xs">
                    Use manual zoom controls
                  </span>
                </div>

                <span className="text-xs text-emerald-200">Enhanced AI</span>
              </div>
              <h1 className="text-2xl font-black text-center text-white mb-1">
                🎯 TACTICAL POSTURE SCANNER
              </h1>
              <p className="text-emerald-100 text-center text-xs font-medium">
                Portrait Mode • 9:16 Body Scanning • Railway API
              </p>
            </div>
          </div>
        </>
      )}

      {!hasSelectedDrill ? (
        <div className="px-4 py-4 space-y-4">
          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-800/85 p-4 sm:p-5 shadow-2xl">
            <h2 className="text-2xl font-black tracking-wide text-emerald-400">
              SELECT DRILL
            </h2>
            <p className="text-slate-300 text-sm mt-1 mb-4">
              Choose a drill to guide the analysis
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(postureTypes).map(
                ([key, posture], index, entries) => {
                  const isActive = currentPosture === key;
                  const isLastOddCard =
                    entries.length % 2 === 1 && index === entries.length - 1;
                  const drillIcon =
                    key === "salutation"
                      ? "🫡"
                      : key === "marching"
                        ? "🚶"
                        : "🧍";

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectDrill(key)}
                      className={`relative w-full rounded-2xl border p-4 min-h-[128px] transition-all duration-200 flex flex-col items-center justify-center text-center ${
                        isLastOddCard
                          ? "col-span-2 md:col-span-1 justify-self-center max-w-[220px] md:max-w-none"
                          : ""
                      } ${
                        isActive
                          ? "bg-emerald-500/15 border-emerald-400 shadow-lg shadow-emerald-500/20"
                          : "bg-slate-800/75 border-slate-600/80 hover:border-emerald-400/70"
                      }`}
                    >
                      <div className="text-3xl mb-2">{drillIcon}</div>
                      <div className="text-white font-extrabold text-lg leading-tight text-center">
                        {posture.title}
                      </div>
                      {isActive && (
                        <span className="absolute top-3 right-3 w-8 h-8 rounded-full bg-emerald-400 text-slate-900 font-black flex items-center justify-center">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="max-w-5xl mx-auto rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-800/85 p-4 sm:p-5 shadow-2xl">
            <h3 className="text-center text-2xl font-black tracking-wide text-emerald-400 mb-4">
              HOW IT WORKS
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-100">
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/55 p-4">
                <div className="text-emerald-400 text-xl font-black mb-1">
                  1. Select Drill
                </div>
                <p className="text-slate-300 text-sm">
                  Choose the drill you want to practice.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/55 p-4">
                <div className="text-emerald-400 text-xl font-black mb-1">
                  2. Position Yourself
                </div>
                <p className="text-slate-300 text-sm">
                  Align your full body in the frame.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-slate-900/55 p-4">
                <div className="text-emerald-400 text-xl font-black mb-1">
                  3. Start Scan
                </div>
                <p className="text-slate-300 text-sm">
                  Get real-time feedback on your posture.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Camera Section */}
          <div
            ref={cameraSectionRef}
            className="flex-1 flex flex-col px-4 py-4"
          >
            <div className="relative flex-1 max-w-sm mx-auto w-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
              {cameraError ? (
                <div className="aspect-[9/16] flex items-center justify-center p-8">
                  <div className="text-center max-w-sm">
                    <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/50">
                      <svg
                        className="w-10 h-10 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-red-400 mb-3">
                      {cameraError.title}
                    </h3>
                    <p className="text-slate-300 text-sm mb-6">
                      {cameraError.message}
                    </p>
                    <button
                      onClick={retryCamera}
                      className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg"
                    >
                      🔄 {cameraError.action}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="relative aspect-[9/16] max-w-md mx-auto"
                  onTouchStart={handleCameraTouchStart}
                  onTouchMove={handleCameraTouchMove}
                  onTouchEnd={handleCameraTouchEnd}
                  onTouchCancel={handleCameraTouchEnd}
                  style={{ touchAction: zoomSupported ? "none" : "auto" }}
                >
                  {/* Real-time detection active indicator */}
                  {isRealTimeActive && (
                    <div
                      className={`absolute inset-0 border-4 rounded-lg pointer-events-none z-10 transition-all duration-300 ${
                        liveScore && liveScore >= 75
                          ? "border-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"
                          : "border-purple-500/30"
                      }`}
                    ></div>
                  )}

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover rounded-lg ${currentCamera === "front" ? "scale-x-[-1]" : ""}`}
                  />

                  {/* Canvas overlay for dynamic keypoint rendering from dataset */}
                  <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 w-full h-full object-cover rounded-lg pointer-events-none ${currentCamera === "front" ? "scale-x-[-1]" : ""}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      zIndex: 10,
                    }}
                  />

                  {/* Body Scanning Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Camera Switch Button - Top Right Corner */}
                    {canAttemptCameraSwitch && (
                      <button
                        onClick={switchCamera}
                        disabled={cameraLoading || isScanning}
                        className={`absolute top-20 right-4 z-10 pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 ${
                          cameraLoading || isScanning
                            ? "bg-slate-600/80 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-600/90 hover:bg-emerald-500 text-white hover:scale-110 active:scale-95 animate-pulse"
                        } border-2 border-emerald-400/50`}
                        title={`Switch to ${currentCamera === "front" ? "back" : "front"} camera`}
                        aria-label={`Switch to ${currentCamera === "front" ? "back" : "front"} camera`}
                      >
                        <span className="text-lg">
                          {currentCamera === "front" ? "📷" : "🤳"}
                        </span>
                      </button>
                    )}

                    {/* Top action row: Exit | Current Drill | Save Result */}
                    <div className="absolute top-4 inset-x-4 z-20 grid grid-cols-[auto_1fr_auto] items-center gap-2 pointer-events-none">
                      <button
                        onClick={handleExitToDrillSelection}
                        aria-label="Back"
                        title="Back"
                        className="bg-slate-800/95 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-md border border-slate-500/70 pointer-events-auto"
                      >
                        ←
                      </button>

                      <div className="justify-self-center bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 border border-emerald-500/30 max-w-full">
                        <div className="text-emerald-400 text-sm font-bold text-center whitespace-nowrap overflow-hidden text-ellipsis">
                          {currentPosture === "salutation" &&
                            "🫡 SALUTATION POSE"}
                          {currentPosture === "marching" && "🚶 MARCHING POSE"}
                          {currentPosture === "attention" &&
                            "🧍 ATTENTION POSE"}
                        </div>
                      </div>

                      <button
                        onClick={handleManualLiveSave}
                        disabled={
                          !isRealTimeActive ||
                          liveScore === null ||
                          isSavingLiveResult ||
                          cameraLoading ||
                          !!cameraError
                        }
                        className={`text-xs font-bold px-3 py-2 rounded-md border pointer-events-auto transition-all duration-200 ${
                          !isRealTimeActive ||
                          liveScore === null ||
                          cameraLoading ||
                          !!cameraError
                            ? "bg-slate-700/80 border-slate-500 text-slate-300 cursor-not-allowed"
                            : isSavingLiveResult
                              ? "bg-emerald-700/90 border-emerald-400 text-white"
                              : "bg-emerald-600/90 hover:bg-emerald-500 border-emerald-400 text-white"
                        }`}
                      >
                        {isSavingLiveResult ? "Saving..." : "💾 Save"}
                      </button>
                    </div>

                    {/* Bottom control dock: left feedback, center shutter, right pose % */}
                    <div className="absolute bottom-4 inset-x-4 z-20 grid grid-cols-[1fr_auto_1fr] items-end pointer-events-none">
                      {/* Left: Real-time posture coaching */}
                      <div className="justify-self-start pointer-events-none max-w-[40vw] sm:max-w-[36vw] min-w-[100px]">
                        {isRealTimeActive &&
                        (currentPosture === "attention" ||
                          currentPosture === "salutation" ||
                          currentPosture === "marching") &&
                        liveCorrections.length > 0 ? (
                          <div className="bg-slate-900/92 backdrop-blur-md rounded-xl border border-slate-600/50 shadow-2xl overflow-hidden">
                            <div
                              className={`px-2 py-1 text-[9px] font-black tracking-wider ${livePassed ? "bg-emerald-600/80 text-emerald-50" : "bg-red-600/70 text-red-50"}`}
                            >
                              {livePassed ? "✅ PASS" : "❌ FAIL"} — POSTURE
                            </div>
                            <div className="px-1.5 py-1 space-y-px max-h-[35vh] overflow-y-auto">
                              {liveCorrections.map((c, i) => (
                                <div
                                  key={`${c.bodyPart}-${i}`}
                                  className={`flex items-start gap-1 rounded px-1 py-0.5 text-[9px] leading-tight ${c.status === "good" ? "text-emerald-300" : c.status === "warning" ? "text-yellow-300 bg-yellow-500/8" : c.status === "error" ? "text-orange-300 bg-orange-500/10" : "text-red-300 bg-red-500/12"}`}
                                >
                                  <span className="shrink-0 text-[10px] leading-none mt-px">
                                    {c.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <span className="font-bold">
                                      {c.bodyPart}
                                    </span>
                                    <span className="mx-0.5 opacity-50">—</span>
                                    <span className="opacity-90">
                                      {c.suggestion}
                                    </span>
                                    {c.deduction > 0 && (
                                      <span className="ml-0.5 opacity-60">
                                        (-{c.deduction})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-1" />
                        )}
                      </div>

                      <div className="justify-self-center relative">
                        {isRealTimeActive && !cameraError && !cameraLoading && (
                          <div className="absolute -inset-2 z-10 pointer-events-none">
                            <span className="block w-20 h-20 rounded-full border-2 border-red-400/40 animate-ping"></span>
                          </div>
                        )}
                        <button
                          onClick={toggleRealTimeDetection}
                          disabled={!!cameraError || cameraLoading}
                          aria-label={
                            isRealTimeActive
                              ? "Stop live detection"
                              : "Start live detection"
                          }
                          title={
                            isRealTimeActive
                              ? "Stop live detection"
                              : "Start live detection"
                          }
                          className={`relative z-20 pointer-events-auto w-16 h-16 rounded-full transition-all duration-200 shadow-2xl border-4 flex items-center justify-center ${
                            cameraError || cameraLoading
                              ? "bg-slate-700/80 border-slate-500/60 cursor-not-allowed"
                              : isRealTimeActive
                                ? "bg-white/95 border-red-500 active:scale-95"
                                : "bg-white/95 border-white/90 active:scale-95"
                          }`}
                        >
                          <span
                            className={`block rounded-full transition-all duration-200 ${
                              cameraError || cameraLoading
                                ? "w-8 h-8 bg-slate-500"
                                : isRealTimeActive
                                  ? "w-7 h-7 bg-red-600 rounded-md"
                                  : "w-10 h-10 bg-slate-900"
                            }`}
                          ></span>
                        </button>
                      </div>

                      <div className="justify-self-end pointer-events-none bg-slate-900/90 backdrop-blur rounded-xl px-3 py-2 border border-purple-500/50 min-w-[78px] text-center shadow-xl">
                        <div
                          className={`text-lg font-black leading-none ${
                            liveScore === null
                              ? "text-slate-300"
                              : liveScore >= 85
                                ? "text-emerald-400"
                                : liveScore >= 75
                                  ? "text-yellow-400"
                                  : "text-red-400"
                          }`}
                        >
                          {liveScore === null ? "--" : `${liveScore}%`}
                        </div>
                        <div className="text-[10px] text-purple-300 font-bold mt-1">
                          {liveScore === null
                            ? "WAIT"
                            : liveScore >= 85
                              ? "EXCELLENT"
                              : liveScore >= 75
                                ? "GOOD"
                                : "ADJUST"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {cameraLoading && (
                    <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                        <p className="text-emerald-400 font-bold">
                          🔍 INITIALIZING {currentCamera.toUpperCase()}{" "}
                          CAMERA...
                        </p>
                        {hasBackCamera && (
                          <p className="text-emerald-300 text-xs mt-2">
                            📷 {availableCameras.length} camera
                            {availableCameras.length !== 1 ? "s" : ""} detected
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {isScanning && (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border-4 border-emerald-500 animate-pulse">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/50">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span className="text-emerald-400 font-bold text-lg">
                              🔍 SCANNING POSTURE...
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Result Overlay */}
              {scanResult && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl flex items-center justify-center z-40">
                  <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-8 mx-4 max-w-sm w-full border border-emerald-500/30 shadow-2xl shadow-emerald-500/10">
                    <div className="text-center">
                      <div
                        className={`w-24 h-24 mx-auto mb-6 rounded-xl flex items-center justify-center border-2 shadow-2xl ${
                          scanResult.success
                            ? "bg-emerald-500/20 border-emerald-500/50 shadow-emerald-500/25"
                            : "bg-red-500/20 border-red-500/50 shadow-red-500/25"
                        }`}
                      >
                        {scanResult.success ? (
                          <svg
                            className="w-12 h-12 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-12 h-12 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      </div>
                      <h3
                        className={`text-2xl font-black mb-4 ${scanResult.success ? "text-emerald-400" : "text-red-400"}`}
                      >
                        {scanResult.success
                          ? "MISSION SUCCESS!"
                          : "REQUIRES ADJUSTMENT"}
                      </h3>
                      <div className="mb-6">
                        <div className="text-4xl font-black text-white mb-1">
                          {scanResult.score}%
                        </div>
                        <div className="text-sm text-emerald-300 font-bold tracking-wider">
                          TACTICAL SCORE
                        </div>
                        {scanResult.confidence && (
                          <div className="text-xs text-slate-400 mt-1">
                            Confidence:{" "}
                            {Math.round(scanResult.confidence * 100)}%
                          </div>
                        )}
                      </div>
                      {scanResult.image && (
                        <div className="mb-5">
                          <div className="text-xs text-slate-400 font-bold mb-2">
                            📸 CAPTURED FRAME
                          </div>
                          <img
                            src={scanResult.image}
                            alt="Captured scan frame"
                            className="w-full h-56 object-contain rounded-lg border border-emerald-500/30 bg-slate-900/60"
                          />
                        </div>
                      )}
                      <p className="text-slate-300 text-sm mb-4 font-medium">
                        {scanResult.feedback}
                      </p>
                      {scanResult.recommendations &&
                        scanResult.recommendations.length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-emerald-400 text-sm font-bold mb-2">
                              📋 RECOMMENDATIONS:
                            </h4>
                            <ul className="text-slate-300 text-xs space-y-1">
                              {scanResult.recommendations.map((rec, index) => (
                                <li
                                  key={index}
                                  className="flex items-start space-x-2"
                                >
                                  <span className="text-emerald-400 mt-0.5">
                                    •
                                  </span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      <button
                        onClick={resetScan}
                        className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-4 px-4 rounded-xl font-black hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-2xl shadow-emerald-500/25"
                      >
                        🔄 RESCAN POSTURE
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Countdown Overlay */}
              {scanCountdown !== null && (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl flex items-center justify-center z-40">
                  <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-12 border border-emerald-500/50 shadow-2xl">
                    <div className="text-center">
                      <div className="text-8xl font-black text-emerald-400 mb-6 animate-pulse">
                        {scanCountdown}
                      </div>
                      <p className="text-slate-300 text-xl font-bold">
                        PREPARE FOR TACTICAL SCAN
                      </p>
                      <div className="flex items-center justify-center space-x-2 mt-3">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-emerald-300 text-sm font-bold">
                          SYSTEM ARMED
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Calculate posture score (move above usage)
function calculateScore(
  customKeypoints: { x: number; y: number; confidence: any; name: string }[],
  ideal: { x: number; y: number; confidence: number; name: string }[],
  postureType: string,
  rawMoveNetKeypoints?: {
    x: number;
    y: number;
    score?: number;
    name?: string;
  }[],
): PostureScoreResult {
  const corrections: BodyPartCorrection[] = [];
  const errorKeypointIndices: number[] = [];
  const warningKeypointIndices: number[] = [];

  if (customKeypoints.length === 0 || ideal.length === 0) {
    return {
      score: 0,
      passed: false,
      corrections: [],
      errorKeypointIndices: [],
      warningKeypointIndices: [],
    };
  }

  let totalDistance = 0;
  let validPoints = 0;

  for (let i = 0; i < Math.min(customKeypoints.length, ideal.length); i++) {
    const current = customKeypoints[i];
    const idealPoint = ideal[i];

    if (current.confidence > 0.3) {
      const dx = current.x - idealPoint.x;
      const dy = current.y - idealPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      totalDistance += distance;
      validPoints++;
    }
  }

  if (validPoints === 0) {
    return {
      score: 0,
      passed: false,
      corrections: [],
      errorKeypointIndices: [],
      warningKeypointIndices: [],
    };
  }

  const averageDistance = totalDistance / validPoints;
  let score = Math.max(0, Math.min(100, 100 - averageDistance * 100));
  const visibilityThreshold = 0.3;
  const visiblePointCount = customKeypoints.filter(
    (point) => point.confidence > visibilityThreshold,
  ).length;

  // Pose-specific hard gates to prevent "wrong movement, high score"
  // from getting a good result just because full-body landmarks are visible.
  const kp = (index: number) => customKeypoints[index];
  const visible = (index: number, min = visibilityThreshold) => {
    const point = kp(index);
    return Boolean(point && point.confidence > min);
  };

  // Index mapping from mapMoveNetToCustom return order
  const HEAD = 0;
  const LEFT_SHOULDER = 2;
  const LEFT_ELBOW = 3;
  const LEFT_HAND = 4;
  const RIGHT_SHOULDER = 5;
  const RIGHT_ELBOW = 6;
  const HIPS_CENTER = 7;
  const RIGHT_HAND = 8;
  const LEFT_HIP = 9;
  const RIGHT_HIP = 10;
  const LEFT_KNEE = 11;
  const RIGHT_KNEE = 12;
  const LEFT_ANKLE = 13;
  const RIGHT_ANKLE = 14;

  let scoreCap = 100;
  let ruleScore = 0;

  const jointAngle = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    c: { x: number; y: number },
  ) => {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180) / Math.PI);
    if (angle > 180) angle = 360 - angle;
    return angle;
  };

  // Global visibility quality gates:
  // prevent high scores when too few landmarks are visible.
  if (visiblePointCount < 8) {
    scoreCap = Math.min(scoreCap, 30);
  } else if (visiblePointCount < 10) {
    scoreCap = Math.min(scoreCap, 50);
  } else if (visiblePointCount < 12) {
    scoreCap = Math.min(scoreCap, 70);
  }

  // Side-view heuristic: body appears narrow in x-axis vs torso height.
  let isSideView = false;
  if (
    visible(HEAD, 0.35) &&
    visible(HIPS_CENTER, 0.35) &&
    visible(LEFT_SHOULDER, 0.3) &&
    visible(RIGHT_SHOULDER, 0.3) &&
    visible(LEFT_HIP, 0.3) &&
    visible(RIGHT_HIP, 0.3)
  ) {
    const head = kp(HEAD);
    const hips = kp(HIPS_CENTER);
    const torsoHeight = Math.max(0.12, Math.abs(hips.y - head.y));
    const shoulderWidth = Math.abs(kp(LEFT_SHOULDER).x - kp(RIGHT_SHOULDER).x);
    const hipWidth = Math.abs(kp(LEFT_HIP).x - kp(RIGHT_HIP).x);
    const bodyWidthRatio = Math.max(shoulderWidth, hipWidth) / torsoHeight;
    isSideView = bodyWidthRatio < 0.24;
  }

  if (postureType === "salutation") {
    // ===== STRICT PROPER SALUTATION (HAND SALUTE) VALIDATION =====
    let saluteDeductions = 0;
    let hardFail = false;

    const saluteRequiredVisible =
      visible(RIGHT_HAND, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3) &&
      visible(HEAD, 0.3) &&
      visible(RIGHT_ELBOW, 0.3);
    if (!saluteRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }

    // Body-size references
    const salShoulderW =
      visible(LEFT_SHOULDER, 0.3) && visible(RIGHT_SHOULDER, 0.3)
        ? Math.abs(kp(LEFT_SHOULDER).x - kp(RIGHT_SHOULDER).x)
        : 0;
    const salTorsoH =
      visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)
        ? Math.max(0.05, Math.abs(kp(HIPS_CENTER).y - kp(HEAD).y))
        : 0.25;

    // --- HAND-TO-HEAD: right hand near right eyebrow ---
    if (
      visible(RIGHT_HAND, 0.3) &&
      visible(HEAD, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3)
    ) {
      const rHand = kp(RIGHT_HAND),
        head = kp(HEAD),
        rShoulder = kp(RIGHT_SHOULDER);
      const handRaised = rHand.y < rShoulder.y;
      const saluteRefX = head.x + (rShoulder.x - head.x) * 0.25;
      const saluteRefY = head.y;
      const handToRefDist = Math.sqrt(
        Math.pow(rHand.x - saluteRefX, 2) + Math.pow(rHand.y - saluteRefY, 2),
      );
      const handToRefRatio = handToRefDist / salTorsoH;
      const handFarAboveHead = rHand.y < head.y - salTorsoH * 0.2;
      const handBelowForehead = rHand.y > head.y + salTorsoH * 0.2;
      const handOnTopOfHead =
        rHand.y < head.y - salTorsoH * 0.1 &&
        Math.abs(rHand.x - head.x) <
          (salShoulderW > 0.02 ? salShoulderW * 0.3 : 0.04);

      if (!handRaised) {
        saluteDeductions += 25;
        hardFail = true;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "fail",
          suggestion: "Raise right hand to forehead",
          deduction: 25,
        });
        errorKeypointIndices.push(RIGHT_HAND);
      } else if (handOnTopOfHead) {
        saluteDeductions += 20;
        hardFail = true;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "fail",
          suggestion: "Hand is on top of head - bring to right eyebrow",
          deduction: 20,
        });
        errorKeypointIndices.push(RIGHT_HAND);
      } else if (handToRefRatio > 0.55) {
        saluteDeductions += 20;
        hardFail = true;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "fail",
          suggestion: "Hand is too far from forehead",
          deduction: 20,
        });
        errorKeypointIndices.push(RIGHT_HAND);
      } else if (handFarAboveHead) {
        saluteDeductions += 15;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "error",
          suggestion: "Hand is too high - align near right eyebrow",
          deduction: 15,
        });
        errorKeypointIndices.push(RIGHT_HAND);
      } else if (handBelowForehead) {
        saluteDeductions += 15;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "error",
          suggestion: "Raise right hand higher toward forehead",
          deduction: 15,
        });
        errorKeypointIndices.push(RIGHT_HAND);
      } else if (handToRefRatio > 0.35) {
        saluteDeductions += 8;
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "warning",
          suggestion: "Align forefinger near right eyebrow",
          deduction: 8,
        });
        warningKeypointIndices.push(RIGHT_HAND);
      } else {
        corrections.push({
          bodyPart: "Salute Hand",
          icon: "🖐️",
          status: "good",
          suggestion: "Hand at forehead - correct",
          deduction: 0,
        });
      }

      // Attention-like detection
      const rHip = visible(RIGHT_HIP, 0.3) ? kp(RIGHT_HIP) : kp(HIPS_CENTER);
      const handAtHipLevel = rHand.y > rHip.y - salTorsoH * 0.05;
      const handNearHip =
        salShoulderW > 0.02
          ? Math.abs(rHand.x - rHip.x) < salShoulderW * 0.5
          : Math.abs(rHand.x - rHip.x) < 0.1;
      if (handAtHipLevel && handNearHip) {
        scoreCap = Math.min(scoreCap, 20);
      }
    } else {
      saluteDeductions += 25;
      hardFail = true;
      corrections.push({
        bodyPart: "Salute Hand",
        icon: "🖐️",
        status: "fail",
        suggestion: "Right hand not detected - raise hand to forehead",
        deduction: 25,
      });
    }

    // --- ELBOW ---
    if (
      visible(RIGHT_ELBOW, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3) &&
      visible(RIGHT_HAND, 0.3)
    ) {
      const rElbow = kp(RIGHT_ELBOW),
        rShoulder = kp(RIGHT_SHOULDER),
        rHand = kp(RIGHT_HAND);
      const elbowDropRatio = (rElbow.y - rShoulder.y) / salTorsoH;
      const forearmAngle = jointAngle(rShoulder, rElbow, rHand);
      if (elbowDropRatio > 0.25) {
        saluteDeductions += 15;
        hardFail = true;
        corrections.push({
          bodyPart: "Elbow",
          icon: "💪",
          status: "fail",
          suggestion: "Raise your right elbow higher",
          deduction: 15,
        });
        errorKeypointIndices.push(RIGHT_ELBOW);
      } else if (elbowDropRatio > 0.12) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Elbow",
          icon: "💪",
          status: "error",
          suggestion: "Keep elbow slightly forward and up",
          deduction: 10,
        });
        errorKeypointIndices.push(RIGHT_ELBOW);
      } else {
        corrections.push({
          bodyPart: "Elbow",
          icon: "💪",
          status: "good",
          suggestion: "Elbow position correct",
          deduction: 0,
        });
      }
      if (forearmAngle < 20 || forearmAngle > 100) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Forearm",
          icon: "📐",
          status: "error",
          suggestion: "Adjust forearm angle - aim for ~45°",
          deduction: 10,
        });
      }
    }

    // --- HEAD ---
    if (
      visible(HEAD, 0.3) &&
      visible(LEFT_SHOULDER, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3)
    ) {
      const head = kp(HEAD);
      const scX = (kp(LEFT_SHOULDER).x + kp(RIGHT_SHOULDER).x) / 2;
      const headOff = Math.abs(head.x - scX);
      const headOffRatio =
        salShoulderW > 0.02 ? headOff / salShoulderW : headOff / 0.1;
      if (headOffRatio > 0.45) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Head",
          icon: "🧠",
          status: "error",
          suggestion: "Face straight forward while saluting",
          deduction: 10,
        });
        errorKeypointIndices.push(HEAD);
      } else if (headOffRatio > 0.25) {
        saluteDeductions += 5;
        corrections.push({
          bodyPart: "Head",
          icon: "🧠",
          status: "warning",
          suggestion: "Keep head centered",
          deduction: 5,
        });
      } else {
        corrections.push({
          bodyPart: "Head",
          icon: "🧠",
          status: "good",
          suggestion: "Head position correct",
          deduction: 0,
        });
      }
    }

    // --- SHOULDERS ---
    if (visible(LEFT_SHOULDER, 0.3) && visible(RIGHT_SHOULDER, 0.3)) {
      const sDiff = Math.abs(kp(LEFT_SHOULDER).y - kp(RIGHT_SHOULDER).y);
      const sDiffRatio = salTorsoH > 0.05 ? sDiff / salTorsoH : sDiff / 0.05;
      if (sDiffRatio > 0.15) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Shoulders",
          icon: "💪",
          status: "error",
          suggestion: "Level both shoulders while saluting",
          deduction: 10,
        });
        errorKeypointIndices.push(LEFT_SHOULDER, RIGHT_SHOULDER);
      } else {
        corrections.push({
          bodyPart: "Shoulders",
          icon: "💪",
          status: "good",
          suggestion: "Shoulders level",
          deduction: 0,
        });
      }
    }

    // --- BODY VERTICALITY ---
    if (visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)) {
      const head = kp(HEAD),
        hips = kp(HIPS_CENTER);
      const leanR =
        Math.abs(head.x - hips.x) / Math.max(0.05, Math.abs(hips.y - head.y));
      if (leanR >= 0.3) {
        saluteDeductions += 15;
        hardFail = true;
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "fail",
          suggestion: "Stand upright while saluting",
          deduction: 15,
        });
        errorKeypointIndices.push(HEAD, HIPS_CENTER);
      } else if (leanR >= 0.15) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "error",
          suggestion: "Maintain upright posture",
          deduction: 10,
        });
      } else {
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "good",
          suggestion: "Torso upright",
          deduction: 0,
        });
      }
    }

    // --- LEFT ARM: at side ---
    if (
      visible(LEFT_HAND, 0.3) &&
      visible(LEFT_SHOULDER, 0.3) &&
      visible(HIPS_CENTER, 0.3)
    ) {
      const lH = kp(LEFT_HAND),
        lS = kp(LEFT_SHOULDER),
        hips = kp(HIPS_CENTER);
      const lXOff =
        salShoulderW > 0.02
          ? Math.abs(lH.x - lS.x) / salShoulderW
          : Math.abs(lH.x - lS.x) / 0.1;
      const lHandDown = lH.y > hips.y - salTorsoH * 0.08;
      if (!lHandDown || lXOff > 0.7) {
        saluteDeductions += 10;
        corrections.push({
          bodyPart: "Left Arm",
          icon: "🤲",
          status: "error",
          suggestion: "Keep left arm straight at your side",
          deduction: 10,
        });
        errorKeypointIndices.push(LEFT_HAND, LEFT_ELBOW);
      } else {
        corrections.push({
          bodyPart: "Left Arm",
          icon: "🤲",
          status: "good",
          suggestion: "Left arm at side",
          deduction: 0,
        });
      }
    }

    // --- TWO-HAND SALUTE REJECTION ---
    if (
      visible(LEFT_HAND, 0.3) &&
      visible(LEFT_SHOULDER, 0.3) &&
      visible(HEAD, 0.3)
    ) {
      const lH = kp(LEFT_HAND),
        lS = kp(LEFT_SHOULDER),
        head = kp(HEAD);
      const leftRaised = lH.y < lS.y;
      const leftNearHead =
        Math.sqrt(Math.pow(lH.x - head.x, 2) + Math.pow(lH.y - head.y, 2)) /
          salTorsoH <
        0.4;
      if (leftRaised && leftNearHead) {
        saluteDeductions += 20;
        hardFail = true;
        corrections.push({
          bodyPart: "Wrong Hand",
          icon: "🚫",
          status: "fail",
          suggestion: "Salute with RIGHT hand only",
          deduction: 20,
        });
        errorKeypointIndices.push(LEFT_HAND, LEFT_ELBOW);
      }
    }

    ruleScore = Math.max(0, 100 - saluteDeductions);
    if (hardFail) {
      scoreCap = Math.min(scoreCap, 25);
    }
    if (!saluteRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }
  } else if (postureType === "attention") {
    // ===== STRICT PROPER ATTENTION POSTURE VALIDATION =====
    let attentionDeductions = 0;
    let hardFail = false;

    const attentionRequiredVisible =
      visible(LEFT_HAND, 0.3) &&
      visible(RIGHT_HAND, 0.3) &&
      visible(HIPS_CENTER, 0.3) &&
      visible(LEFT_SHOULDER, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3);

    if (!attentionRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }

    // --- HEAD ---
    // --- HEAD (position + rotation + tilt) ---
    if (
      visible(HEAD, 0.3) &&
      visible(LEFT_SHOULDER, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3)
    ) {
      const head = kp(HEAD);
      const scX = (kp(LEFT_SHOULDER).x + kp(RIGHT_SHOULDER).x) / 2;
      const headOff = Math.abs(head.x - scX);
      let headDeduction = 0;
      let headSeverity: CorrectionSeverity = "good";
      let headSuggestion = "Head position correct";

      // 1) Horizontal displacement check
      if (headOff >= 0.1) {
        headDeduction = 20;
        headSeverity = "fail";
        headSuggestion = "Face straight forward";
        hardFail = true;
      } else if (headOff >= 0.06) {
        headDeduction = 20;
        headSeverity = "error";
        headSuggestion = "Keep your head level and centered";
      } else if (headOff >= 0.04) {
        headDeduction = 10;
        headSeverity = "warning";
        headSuggestion = "Align your head to the center";
      }

      // 2) Head ROTATION detection via raw MoveNet ear/eye keypoints
      if (rawMoveNetKeypoints && rawMoveNetKeypoints.length >= 5) {
        const rawLEye = rawMoveNetKeypoints[1];
        const rawREye = rawMoveNetKeypoints[2];
        const rawLEar = rawMoveNetKeypoints[3];
        const rawREar = rawMoveNetKeypoints[4];
        const lEyeConf = rawLEye?.score ?? 0;
        const rEyeConf = rawREye?.score ?? 0;
        const lEarConf = rawLEar?.score ?? 0;
        const rEarConf = rawREar?.score ?? 0;

        // Ear confidence asymmetry: if one ear is much less visible, head is turned
        const earConfDiff = Math.abs(lEarConf - rEarConf);
        const minEarConf = Math.min(lEarConf, rEarConf);
        const earAsymmetry =
          (lEarConf > 0.15 || rEarConf > 0.15) &&
          (earConfDiff > 0.35 || minEarConf < 0.15);

        // Eye confidence asymmetry
        const eyeConfDiff = Math.abs(lEyeConf - rEyeConf);
        const eyeAsymmetry =
          (lEyeConf > 0.2 || rEyeConf > 0.2) && eyeConfDiff > 0.3;

        // 3) Head TILT detection via eye vertical difference
        let headTilted = false;
        if (lEyeConf > 0.3 && rEyeConf > 0.3) {
          const eyeYDiff = Math.abs(rawLEye.y - rawREye.y);
          const eyeXSpan = Math.abs(rawLEye.x - rawREye.x);
          if (eyeXSpan > 0) {
            const tiltRatio = eyeYDiff / eyeXSpan;
            if (tiltRatio > 0.35) {
              headTilted = true;
            }
          }
        }

        // Apply rotation/tilt penalties (upgrade severity if worse than position check)
        const headRotated = earAsymmetry || eyeAsymmetry;
        const headStronglyRotated = earAsymmetry && eyeAsymmetry;

        if (headStronglyRotated && headDeduction < 20) {
          headDeduction = 20;
          headSeverity = "error";
          headSuggestion = "Face straight forward";
        } else if (headRotated && headDeduction < 15) {
          headDeduction = 15;
          headSeverity = headSeverity === "good" ? "warning" : headSeverity;
          headSuggestion = "Keep your head level";
        }

        if (headTilted && headDeduction < 10) {
          headDeduction = Math.max(headDeduction, 10);
          headSeverity = headSeverity === "good" ? "warning" : headSeverity;
          headSuggestion = "Keep your head level";
        }
      }

      attentionDeductions += headDeduction;
      corrections.push({
        bodyPart: "Head",
        icon: "🧠",
        status: headSeverity,
        suggestion: headSuggestion,
        deduction: headDeduction,
      });
      if (headSeverity === "fail" || headSeverity === "error")
        errorKeypointIndices.push(HEAD);
      else if (headSeverity === "warning") warningKeypointIndices.push(HEAD);

      if (
        visible(HIPS_CENTER, 0.3) &&
        Math.abs(head.x - kp(HIPS_CENTER).x) >= 0.09
      ) {
        attentionDeductions += 5;
      }
    }

    // --- SHOULDERS ---
    if (visible(LEFT_SHOULDER, 0.3) && visible(RIGHT_SHOULDER, 0.3)) {
      const sDiff = Math.abs(kp(LEFT_SHOULDER).y - kp(RIGHT_SHOULDER).y);
      if (sDiff >= 0.06) {
        attentionDeductions += 15;
        corrections.push({
          bodyPart: "Shoulders",
          icon: "💪",
          status: "error",
          suggestion: "Level both shoulders",
          deduction: 15,
        });
        errorKeypointIndices.push(LEFT_SHOULDER, RIGHT_SHOULDER);
      } else if (sDiff >= 0.035) {
        attentionDeductions += 8;
        corrections.push({
          bodyPart: "Shoulders",
          icon: "💪",
          status: "warning",
          suggestion: "Keep shoulders balanced",
          deduction: 8,
        });
        warningKeypointIndices.push(LEFT_SHOULDER, RIGHT_SHOULDER);
      } else {
        corrections.push({
          bodyPart: "Shoulders",
          icon: "💪",
          status: "good",
          suggestion: "Shoulders level",
          deduction: 0,
        });
      }
    }

    // --- ARMS ---
    if (attentionRequiredVisible) {
      const lH = kp(LEFT_HAND),
        rH = kp(RIGHT_HAND),
        hips = kp(HIPS_CENTER);
      const lSide =
        lH.y > hips.y - 0.04 && Math.abs(lH.x - kp(LEFT_SHOULDER).x) < 0.12;
      const rSide =
        rH.y > hips.y - 0.04 && Math.abs(rH.x - kp(RIGHT_SHOULDER).x) < 0.12;
      if (!lSide || !rSide) {
        attentionDeductions += 10;
        corrections.push({
          bodyPart: "Arms",
          icon: "🤲",
          status: "error",
          suggestion: "Keep arms straight at your sides",
          deduction: 10,
        });
        if (!lSide) errorKeypointIndices.push(LEFT_HAND, LEFT_ELBOW);
        if (!rSide) errorKeypointIndices.push(RIGHT_HAND, RIGHT_ELBOW);
      } else {
        corrections.push({
          bodyPart: "Arms",
          icon: "🤲",
          status: "good",
          suggestion: "Arms at sides",
          deduction: 0,
        });
      }
      const rRaised = rH.y < kp(RIGHT_SHOULDER).y - 0.03;
      if (rRaised) {
        attentionDeductions += 20;
        hardFail = true;
        corrections.push({
          bodyPart: "Right Hand",
          icon: "✋",
          status: "fail",
          suggestion: "Place hands closer to thighs",
          deduction: 20,
        });
        errorKeypointIndices.push(RIGHT_HAND, RIGHT_ELBOW);
      }
      if (visible(LEFT_ELBOW, 0.3) && visible(RIGHT_ELBOW, 0.3)) {
        const lA = jointAngle(kp(LEFT_SHOULDER), kp(LEFT_ELBOW), lH);
        const rA = jointAngle(kp(RIGHT_SHOULDER), kp(RIGHT_ELBOW), rH);
        if (lA < 145 || rA < 145) {
          attentionDeductions += 10;
          corrections.push({
            bodyPart: "Elbows",
            icon: "💪",
            status: "error",
            suggestion: "Relax and align your arms",
            deduction: 10,
          });
          if (lA < 145) errorKeypointIndices.push(LEFT_ELBOW);
          if (rA < 145) errorKeypointIndices.push(RIGHT_ELBOW);
        } else if (lA < 160 || rA < 160) {
          attentionDeductions += 5;
          corrections.push({
            bodyPart: "Elbows",
            icon: "💪",
            status: "warning",
            suggestion: "Straighten arms fully",
            deduction: 5,
          });
          if (lA < 160) warningKeypointIndices.push(LEFT_ELBOW);
          if (rA < 160) warningKeypointIndices.push(RIGHT_ELBOW);
        }
      }
    } else {
      attentionDeductions += 15;
    }

    // --- BODY VERTICALITY ---
    if (visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)) {
      const head = kp(HEAD),
        hips = kp(HIPS_CENTER);
      const leanR =
        Math.abs(head.x - hips.x) / Math.max(0.1, Math.abs(hips.y - head.y));
      if (leanR >= 0.35) {
        attentionDeductions += 20;
        hardFail = true;
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "fail",
          suggestion: "Stand upright",
          deduction: 20,
        });
        errorKeypointIndices.push(HEAD, HIPS_CENTER);
      } else if (leanR >= 0.18) {
        attentionDeductions += 20;
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "error",
          suggestion: "Keep your torso vertical",
          deduction: 20,
        });
        errorKeypointIndices.push(HEAD, HIPS_CENTER);
      } else if (leanR >= 0.1) {
        attentionDeductions += 10;
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "warning",
          suggestion: "Avoid leaning to one side",
          deduction: 10,
        });
        warningKeypointIndices.push(HEAD, HIPS_CENTER);
      } else {
        corrections.push({
          bodyPart: "Body",
          icon: "🧍",
          status: "good",
          suggestion: "Torso vertical",
          deduction: 0,
        });
      }
    }

    // --- SYMMETRY ---
    if (
      visible(LEFT_SHOULDER, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3) &&
      visible(LEFT_HIP, 0.3) &&
      visible(RIGHT_HIP, 0.3)
    ) {
      const symOff = Math.abs(
        (kp(LEFT_SHOULDER).x + kp(RIGHT_SHOULDER).x) / 2 -
          (kp(LEFT_HIP).x + kp(RIGHT_HIP).x) / 2,
      );
      if (symOff >= 0.06) {
        attentionDeductions += 10;
      } else if (symOff >= 0.035) {
        attentionDeductions += 5;
      }
    }

    // --- KNEES ---
    if (
      visible(LEFT_HIP, 0.3) &&
      visible(LEFT_KNEE, 0.3) &&
      visible(LEFT_ANKLE, 0.3) &&
      visible(RIGHT_HIP, 0.3) &&
      visible(RIGHT_KNEE, 0.3) &&
      visible(RIGHT_ANKLE, 0.3)
    ) {
      const lK = jointAngle(kp(LEFT_HIP), kp(LEFT_KNEE), kp(LEFT_ANKLE));
      const rK = jointAngle(kp(RIGHT_HIP), kp(RIGHT_KNEE), kp(RIGHT_ANKLE));
      if (lK < 155 || rK < 155) {
        attentionDeductions += 10;
        corrections.push({
          bodyPart: "Knees",
          icon: "🦵",
          status: "error",
          suggestion: "Straighten your knees",
          deduction: 10,
        });
        if (lK < 155) errorKeypointIndices.push(LEFT_KNEE);
        if (rK < 155) errorKeypointIndices.push(RIGHT_KNEE);
      } else if (lK < 165 || rK < 165) {
        attentionDeductions += 5;
        corrections.push({
          bodyPart: "Knees",
          icon: "🦵",
          status: "warning",
          suggestion: "Lock knees naturally without stiffness",
          deduction: 5,
        });
        if (lK < 165) warningKeypointIndices.push(LEFT_KNEE);
        if (rK < 165) warningKeypointIndices.push(RIGHT_KNEE);
      } else {
        corrections.push({
          bodyPart: "Knees",
          icon: "🦵",
          status: "good",
          suggestion: "Knees straight",
          deduction: 0,
        });
      }
    }

    // --- FEET ---
    if (visible(LEFT_ANKLE, 0.3) && visible(RIGHT_ANKLE, 0.3)) {
      const fSpacing = Math.abs(kp(LEFT_ANKLE).x - kp(RIGHT_ANKLE).x);
      let hipWidth = 0;
      if (visible(LEFT_HIP, 0.3) && visible(RIGHT_HIP, 0.3)) {
        hipWidth = Math.abs(kp(LEFT_HIP).x - kp(RIGHT_HIP).x);
      }

      if (hipWidth > 0.01) {
        // Body-relative check
        const feetToHipRatio = fSpacing / hipWidth;
        if (feetToHipRatio > 1.1) {
          attentionDeductions += 15;
          hardFail = true;
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "fail",
            suggestion: "Feet are too far apart - bring heels together",
            deduction: 15,
          });
          errorKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
        } else if (feetToHipRatio > 0.8) {
          attentionDeductions += 12;
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "error",
            suggestion: "Bring your heels closer together",
            deduction: 12,
          });
          errorKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
        } else if (feetToHipRatio > 0.6) {
          attentionDeductions += 5;
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "warning",
            suggestion: "Heels should be closer for attention position",
            deduction: 5,
          });
          warningKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
        } else {
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "good",
            suggestion: "Feet position correct",
            deduction: 0,
          });
        }
      } else {
        // Fallback to absolute thresholds
        if (fSpacing > 0.12) {
          attentionDeductions += 15;
          hardFail = true;
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "fail",
            suggestion: "Feet are too far apart - bring heels together",
            deduction: 15,
          });
          errorKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
        } else if (fSpacing > 0.07) {
          attentionDeductions += 10;
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "warning",
            suggestion: "Bring heels closer for proper attention position",
            deduction: 10,
          });
          warningKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
        } else {
          corrections.push({
            bodyPart: "Feet",
            icon: "👟",
            status: "good",
            suggestion: "Feet position correct",
            deduction: 0,
          });
        }
      }
    }

    ruleScore = Math.max(0, 100 - attentionDeductions);
    if (hardFail) {
      scoreCap = Math.min(scoreCap, 25);
    }
    if (!attentionRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }
  } else if (postureType === "marching") {
    // ===== STRICT PROPER MARCHING VALIDATION (DEDUCTION-BASED) =====
    let marchDeductions = 0;
    let hardFail = false;

    const marchingRequiredVisible =
      visible(LEFT_HIP, 0.3) &&
      visible(RIGHT_HIP, 0.3) &&
      visible(LEFT_KNEE, 0.3) &&
      visible(RIGHT_KNEE, 0.3) &&
      visible(LEFT_ANKLE, 0.3) &&
      visible(RIGHT_ANKLE, 0.3);
    if (!marchingRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }

    // Body-size references
    const mShoulderW =
      visible(LEFT_SHOULDER, 0.3) && visible(RIGHT_SHOULDER, 0.3)
        ? Math.abs(kp(LEFT_SHOULDER).x - kp(RIGHT_SHOULDER).x)
        : 0;
    const mTorsoH =
      visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)
        ? Math.max(0.05, Math.abs(kp(HIPS_CENTER).y - kp(HEAD).y))
        : 0.25;
    const mLegLen = marchingRequiredVisible
      ? Math.max(
          0.05,
          (Math.abs(kp(LEFT_HIP).y - kp(LEFT_ANKLE).y) +
            Math.abs(kp(RIGHT_HIP).y - kp(RIGHT_ANKLE).y)) /
            2,
        )
      : 0.3;

    if (marchingRequiredVisible) {
      const lAnkle = kp(LEFT_ANKLE),
        rAnkle = kp(RIGHT_ANKLE);
      const lKnee = kp(LEFT_KNEE),
        rKnee = kp(RIGHT_KNEE);
      const lHip = kp(LEFT_HIP),
        rHip = kp(RIGHT_HIP);

      // Foot lift ratios (body-relative)
      const leftFootLift = Math.max(0, rAnkle.y - lAnkle.y);
      const rightFootLift = Math.max(0, lAnkle.y - rAnkle.y);
      const leftLiftRatio = leftFootLift / mLegLen;
      const rightLiftRatio = rightFootLift / mLegLen;
      const maxLiftRatio = Math.max(leftLiftRatio, rightLiftRatio);

      const liftThreshold = 0.04;
      const leftLifted = leftLiftRatio > liftThreshold;
      const rightLifted = rightLiftRatio > liftThreshold;
      const bothLifted = leftLifted && rightLifted;
      const oneLegLifted = (leftLifted || rightLifted) && !bothLifted;

      // --- FOOT LIFT ---
      if (bothLifted) {
        marchDeductions += 25;
        hardFail = true;
        corrections.push({
          bodyPart: "Feet",
          icon: "🦶",
          status: "fail",
          suggestion: "Only lift one foot at a time",
          deduction: 25,
        });
        errorKeypointIndices.push(
          LEFT_ANKLE,
          RIGHT_ANKLE,
          LEFT_KNEE,
          RIGHT_KNEE,
        );
      } else if (!oneLegLifted) {
        marchDeductions += 8;
        corrections.push({
          bodyPart: "Feet",
          icon: "🦶",
          status: "warning",
          suggestion: "Lift knees while marching",
          deduction: 8,
        });
        warningKeypointIndices.push(LEFT_ANKLE, RIGHT_ANKLE);
      } else if (maxLiftRatio < 0.08) {
        marchDeductions += 15;
        corrections.push({
          bodyPart: "Feet",
          icon: "🦶",
          status: "error",
          suggestion: "Lift foot higher - insufficient height",
          deduction: 15,
        });
        warningKeypointIndices.push(leftLifted ? LEFT_ANKLE : RIGHT_ANKLE);
      } else if (maxLiftRatio < 0.12) {
        marchDeductions += 8;
        corrections.push({
          bodyPart: "Feet",
          icon: "🦶",
          status: "warning",
          suggestion: "Try to lift knees a bit higher",
          deduction: 8,
        });
      } else {
        corrections.push({
          bodyPart: "Feet",
          icon: "🦶",
          status: "good",
          suggestion: "Good foot lift height",
          deduction: 0,
        });
      }

      // --- KNEE ELEVATION ---
      if (oneLegLifted) {
        const kneeAngle = leftLifted
          ? jointAngle(lHip, lKnee, lAnkle)
          : jointAngle(rHip, rKnee, rAnkle);
        if (kneeAngle > 160) {
          marchDeductions += 10;
          corrections.push({
            bodyPart: "Knees",
            icon: "🦵",
            status: "error",
            suggestion: "Bend knee more during step",
            deduction: 10,
          });
          warningKeypointIndices.push(leftLifted ? LEFT_KNEE : RIGHT_KNEE);
        } else {
          corrections.push({
            bodyPart: "Knees",
            icon: "🦵",
            status: "good",
            suggestion: "Knee elevation correct",
            deduction: 0,
          });
        }
      }

      // --- BODY VERTICALITY ---
      if (visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)) {
        const head = kp(HEAD),
          hips = kp(HIPS_CENTER);
        const leanR =
          Math.abs(head.x - hips.x) / Math.max(0.05, Math.abs(hips.y - head.y));
        if (leanR >= 0.3) {
          marchDeductions += 20;
          hardFail = true;
          corrections.push({
            bodyPart: "Body",
            icon: "🧍",
            status: "fail",
            suggestion: "Stand upright while marching",
            deduction: 20,
          });
          errorKeypointIndices.push(HEAD, HIPS_CENTER);
        } else if (leanR >= 0.18) {
          marchDeductions += 12;
          corrections.push({
            bodyPart: "Body",
            icon: "🧍",
            status: "error",
            suggestion: "Keep body vertical - reduce lean",
            deduction: 12,
          });
          errorKeypointIndices.push(HEAD);
        } else if (leanR >= 0.1) {
          marchDeductions += 5;
          corrections.push({
            bodyPart: "Body",
            icon: "🧍",
            status: "warning",
            suggestion: "Slight body lean detected",
            deduction: 5,
          });
        } else {
          corrections.push({
            bodyPart: "Body",
            icon: "🧍",
            status: "good",
            suggestion: "Body upright",
            deduction: 0,
          });
        }
      }

      // --- SHOULDERS ---
      if (visible(LEFT_SHOULDER, 0.3) && visible(RIGHT_SHOULDER, 0.3)) {
        const sDiff = Math.abs(kp(LEFT_SHOULDER).y - kp(RIGHT_SHOULDER).y);
        const sDiffRatio = mTorsoH > 0.05 ? sDiff / mTorsoH : sDiff / 0.05;
        if (sDiffRatio > 0.18) {
          marchDeductions += 10;
          corrections.push({
            bodyPart: "Shoulders",
            icon: "💪",
            status: "error",
            suggestion: "Keep shoulders level while marching",
            deduction: 10,
          });
          errorKeypointIndices.push(LEFT_SHOULDER, RIGHT_SHOULDER);
        } else if (sDiffRatio > 0.1) {
          marchDeductions += 5;
          corrections.push({
            bodyPart: "Shoulders",
            icon: "💪",
            status: "warning",
            suggestion: "Balance your shoulders",
            deduction: 5,
          });
        } else {
          corrections.push({
            bodyPart: "Shoulders",
            icon: "💪",
            status: "good",
            suggestion: "Shoulders level",
            deduction: 0,
          });
        }
      }

      // --- ARM POSITION ---
      const armsDisciplineVisible =
        visible(LEFT_SHOULDER, 0.3) &&
        visible(LEFT_HAND, 0.3) &&
        visible(RIGHT_SHOULDER, 0.3) &&
        visible(RIGHT_HAND, 0.3) &&
        visible(HIPS_CENTER, 0.3);
      if (armsDisciplineVisible) {
        const aShoulderW = mShoulderW > 0.02 ? mShoulderW : 0.15;
        const xMaxArm = aShoulderW * 0.6;
        const lH = kp(LEFT_HAND),
          rH = kp(RIGHT_HAND),
          hips = kp(HIPS_CENTER);
        const yTol = mTorsoH * 0.1;
        const leftAtSide =
          lH.y > hips.y - yTol &&
          Math.abs(lH.x - kp(LEFT_SHOULDER).x) < xMaxArm;
        const rightAtSide =
          rH.y > hips.y - yTol &&
          Math.abs(rH.x - kp(RIGHT_SHOULDER).x) < xMaxArm;
        if (!leftAtSide || !rightAtSide) {
          const leftRaised = lH.y < kp(LEFT_SHOULDER).y;
          const rightRaised = rH.y < kp(RIGHT_SHOULDER).y;
          if (leftRaised || rightRaised) {
            marchDeductions += 15;
            corrections.push({
              bodyPart: "Arms",
              icon: "🤲",
              status: "error",
              suggestion: "Keep arms at your sides",
              deduction: 15,
            });
            if (!leftAtSide) errorKeypointIndices.push(LEFT_HAND, LEFT_ELBOW);
            if (!rightAtSide)
              errorKeypointIndices.push(RIGHT_HAND, RIGHT_ELBOW);
          } else {
            marchDeductions += 8;
            corrections.push({
              bodyPart: "Arms",
              icon: "🤲",
              status: "warning",
              suggestion: "Arms swinging too much - keep at sides",
              deduction: 8,
            });
          }
        } else {
          corrections.push({
            bodyPart: "Arms",
            icon: "🤲",
            status: "good",
            suggestion: "Arms at sides",
            deduction: 0,
          });
        }
      }

      // --- HEAD ---
      if (
        visible(HEAD, 0.3) &&
        visible(LEFT_SHOULDER, 0.3) &&
        visible(RIGHT_SHOULDER, 0.3)
      ) {
        const head = kp(HEAD);
        const scX = (kp(LEFT_SHOULDER).x + kp(RIGHT_SHOULDER).x) / 2;
        const headOff = Math.abs(head.x - scX);
        const headOffRatio =
          mShoulderW > 0.02 ? headOff / mShoulderW : headOff / 0.1;
        if (headOffRatio > 0.45) {
          marchDeductions += 10;
          corrections.push({
            bodyPart: "Head",
            icon: "🧠",
            status: "error",
            suggestion: "Face forward while marching",
            deduction: 10,
          });
          errorKeypointIndices.push(HEAD);
        } else if (headOffRatio > 0.25) {
          marchDeductions += 5;
          corrections.push({
            bodyPart: "Head",
            icon: "🧠",
            status: "warning",
            suggestion: "Keep head centered",
            deduction: 5,
          });
        } else {
          corrections.push({
            bodyPart: "Head",
            icon: "🧠",
            status: "good",
            suggestion: "Head forward",
            deduction: 0,
          });
        }
      }

      // --- HIP SYMMETRY ---
      const hipDiff = Math.abs(lHip.y - rHip.y);
      const hipDiffRatio = mTorsoH > 0.05 ? hipDiff / mTorsoH : hipDiff / 0.05;
      if (hipDiffRatio > 0.2) {
        marchDeductions += 8;
        corrections.push({
          bodyPart: "Balance",
          icon: "⚖️",
          status: "error",
          suggestion: "Keep hips level - maintain balance",
          deduction: 8,
        });
        warningKeypointIndices.push(LEFT_HIP, RIGHT_HIP);
      } else if (hipDiffRatio > 0.12) {
        marchDeductions += 4;
        corrections.push({
          bodyPart: "Balance",
          icon: "⚖️",
          status: "warning",
          suggestion: "Improve hip balance",
          deduction: 4,
        });
      } else {
        corrections.push({
          bodyPart: "Balance",
          icon: "⚖️",
          status: "good",
          suggestion: "Balance steady",
          deduction: 0,
        });
      }
    }

    ruleScore = Math.max(0, 100 - marchDeductions);
    if (hardFail) {
      scoreCap = Math.min(scoreCap, 25);
    }
    if (!marchingRequiredVisible) {
      scoreCap = Math.min(scoreCap, 40);
    }
  }

  // Score blending: deduction-based ruleScore dominates for all posture types
  if (
    (postureType === "attention" ||
      postureType === "salutation" ||
      postureType === "marching") &&
    ruleScore >= 0
  ) {
    score = score * 0.15 + ruleScore * 0.85;
  } else if (isSideView && ruleScore > 0) {
    score = score * 0.35 + ruleScore * 0.65;
  } else if (ruleScore > 0) {
    score = score * 0.7 + ruleScore * 0.3;
  }

  score = Math.min(score, scoreCap);

  const finalScore = Math.round(score);
  return {
    score: finalScore,
    passed: finalScore >= 75,
    corrections,
    errorKeypointIndices,
    warningKeypointIndices,
  };
}

// Draw skeleton overlay on the canvas
function drawSkeleton(
  customKeypoints: { x: number; y: number; confidence: number; name: string }[],
  score: number,
  canvas: HTMLCanvasElement | null,
  sourceVideoWidth?: number,
  sourceVideoHeight?: number,
  errorKeypointIndices: number[] = [],
  warningKeypointIndices: number[] = [],
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const warningSet = new Set(warningKeypointIndices);
  const errorSet = new Set(errorKeypointIndices);

  const displayWidth = Math.max(
    1,
    Math.round(canvas.clientWidth || canvas.width),
  );
  const displayHeight = Math.max(
    1,
    Math.round(canvas.clientHeight || canvas.height),
  );
  const scaleX = canvas.width / displayWidth;
  const scaleY = canvas.height / displayHeight;
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

  const safeVideoWidth =
    typeof sourceVideoWidth === "number" && sourceVideoWidth > 0
      ? sourceVideoWidth
      : displayWidth;
  const safeVideoHeight =
    typeof sourceVideoHeight === "number" && sourceVideoHeight > 0
      ? sourceVideoHeight
      : displayHeight;

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

  const lineColor =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const pointColor =
    score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";

  const connections = [
    [0, 1],
    [1, 2],
    [1, 5],
    [2, 3],
    [3, 4],
    [5, 6],
    [6, 8],
    [1, 7],
    [7, 9],
    [7, 10],
    [9, 11],
    [11, 13],
    [13, 15],
    [10, 12],
    [12, 14],
    [14, 16],
  ];

  ctx.save();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = dynamicLineWidth;
  ctx.globalAlpha = 1;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur = 6;
  connections.forEach(([a, b]) => {
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

  ctx.shadowBlur = 0;
  customKeypoints.forEach((kp, idx) => {
    if (!kp || kp.confidence < renderThreshold) return;
    const x = offsetX + kp.x * renderedVideoWidth;
    const y = offsetY + kp.y * renderedVideoHeight;

    let kpFill = pointColor;
    let kpRadius = dynamicPointRadius;
    if (errorSet.has(idx)) {
      kpFill = "#f87171";
      kpRadius = dynamicPointRadius * 1.35;
    } else if (warningSet.has(idx)) {
      kpFill = "#fbbf24";
      kpRadius = dynamicPointRadius * 1.15;
    }

    ctx.fillStyle = kpFill;
    ctx.beginPath();
    ctx.arc(x, y, kpRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, dynamicLineWidth * 0.45);
    ctx.stroke();

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
