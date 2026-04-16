import { useState, useRef, useEffect, type TouchEvent } from "react";
import supabase from "../supabase";
import { useLoading } from "../contexts/LoadingContext";
import { useAudio } from "../contexts/AudioContext";
import toast from "react-hot-toast";
import { hybridPostureService } from "../services/hybridPostureService";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-converter";
import "@tensorflow/tfjs-backend-webgl";
import * as poseDetection from "@tensorflow-models/pose-detection";

// Ideal reference keypoints extracted from COCO dataset annotations
// Format: Your custom 17 keypoints - [Head, Neck, L/R Shoulder, L/R Elbow, L/R Hands, Hips, L/R Glute, L/R Knee, L/R Ankle, L/R Feet]
// Coordinates normalized and centered to fill the oval guide area properly
const IDEAL_KEYPOINTS = {
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
  marching: [
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
    { x: 0.42, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.58, y: 0.65, confidence: 1.0, name: "Knee" },
    { x: 0.4, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.6, y: 0.82, confidence: 1.0, name: "Ankle" },
    { x: 0.38, y: 0.9, confidence: 1.0, name: "Feet" },
    { x: 0.62, y: 0.9, confidence: 1.0, name: "Feet" },
  ],
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

// Live Railway API Configuration
const RAILWAY_API_URL = "https://model-cloud-production.up.railway.app";

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

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return [];

    // Normalization helper
    const norm = (val: number, max: number) => {
      if (!max || max <= 0) return 0;
      return Math.max(0, Math.min(1, val / max));
    };

    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      score: ((leftShoulder.score ?? 0) + (rightShoulder.score ?? 0)) / 2,
    };
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      score: ((leftHip.score ?? 0) + (rightHip.score ?? 0)) / 2,
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
      const extension = 0.35;
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
      midPoint(leftShoulder, rightShoulder, "Neck"),
      createPoint(leftShoulder, "Shoulder"),
      createFallbackPoint(leftElbow, leftShoulder, "Elbow"),
      createFallbackPoint(leftWrist, leftElbow ?? leftShoulder, "Hands"),
      createPoint(rightShoulder, "Shoulder"),
      createFallbackPoint(rightElbow, rightShoulder, "Elbow"),
      midPoint(leftHip, rightHip, "Hips"),
      createFallbackPoint(rightWrist, rightElbow ?? rightShoulder, "Hands"),
      createPoint(leftHip, "Glute"),
      createPoint(rightHip, "Glute"),
      createFallbackPoint(leftKnee, leftHip, "Knee"),
      createFallbackPoint(rightKnee, rightHip, "Knee"),
      createFallbackPoint(leftAnkle, leftKnee ?? leftHip, "Ankle"),
      createFallbackPoint(rightAnkle, rightKnee ?? rightHip, "Ankle"),
      leftFoot ?? createFallbackPoint(leftAnkle, leftKnee ?? leftHip, "Feet"),
      rightFoot ??
        createFallbackPoint(rightAnkle, rightKnee ?? rightHip, "Feet"),
    ];
  };

  // [SKELETON VISUALIZATION] Fallback mapper: convert local/hybrid COCO-style
  // keypoints into the custom 17-point order used by drawSkeleton.
  const mapStandardToCustom = (keypoints: any[]) => {
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

    const midpoint = (p1: any, p2: any, name: string) => ({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      confidence: ((p1.confidence ?? 0) + (p2.confidence ?? 0)) / 2,
      name,
    });

    const point = (p: any, name: string) => ({
      x: p?.x ?? 0,
      y: p?.y ?? 0,
      confidence: p?.confidence ?? 0,
      name,
    });

    const safeFoot = (ankle: any, knee: any, name: string) => {
      if (!ankle) return null;
      const dx = knee ? ankle.x - knee.x : 0;
      const dy = knee ? ankle.y - knee.y : 0.03;
      const extension = 0.35;
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
  };
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null);
  // --- 1. DEFINE MOVENET LOADER ---
  const loadMoveNet = async () => {
    try {
      // Ensure the backend required by MoveNet is initialized.
      if (tf.getBackend() !== "webgl") {
        await tf.setBackend("webgl");
      }
      await tf.ready();

      // Create the detector
      const model = poseDetection.SupportedModels.MoveNet;
      const isMobileDevice =
        typeof navigator !== "undefined" &&
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const preferredModelType = isMobileDevice
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING;

      try {
        detectorRef.current = await poseDetection.createDetector(model, {
          modelType: preferredModelType,
          enableSmoothing: true,
        });
        console.log(
          `✅ MoveNet loaded successfully (${isMobileDevice ? "THUNDER mobile" : "LIGHTNING desktop"})`,
        );
      } catch (preferredError) {
        console.warn(
          "⚠️ Preferred MoveNet model failed, falling back to SINGLEPOSE_LIGHTNING",
          preferredError,
        );
        detectorRef.current = await poseDetection.createDetector(model, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
        });
        console.log("✅ MoveNet fallback loaded (LIGHTNING)");
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
        const confidence = poses[0].score || 0;
        setLiveConfidence(confidence);

        const customKeypoints = mapMoveNetToCustom(
          rawKeypoints,
          videoRef.current.videoWidth,
          videoRef.current.videoHeight,
        );

        const ideal =
          IDEAL_KEYPOINTS[currentPosture as keyof typeof IDEAL_KEYPOINTS] ||
          IDEAL_KEYPOINTS.salutation;
        const score = calculateScore(customKeypoints, ideal, currentPosture);
        const visiblePointCount = customKeypoints.filter(
          (point) => point.confidence > 0.3,
        ).length;
        const canBeGood =
          score >= 75 && confidence > 0.5 && visiblePointCount >= 9;

        setLiveScore(score);
        setDetectedPosture(canBeGood ? "Good" : "Adjusting");

        const previousGoodFrameCount = consecutiveGoodFramesRef.current;
        if (canBeGood) {
          consecutiveGoodFramesRef.current += 1;
        } else {
          consecutiveGoodFramesRef.current = 0;
        }

        const now = Date.now();
        const timeSinceLastSave = now - lastSaveTimeRef.current;
        const becameStableGood =
          previousGoodFrameCount < REQUIRED_STABLE_GOOD_FRAMES &&
          consecutiveGoodFramesRef.current >= REQUIRED_STABLE_GOOD_FRAMES;
        const canAutoSaveMore =
          autoSaveCountRef.current < MAX_AUTO_SAVES_PER_SESSION;

        if (
          becameStableGood &&
          timeSinceLastSave >= MIN_SAVE_INTERVAL &&
          canAutoSaveMore
        ) {
          const capturedFrame = captureImage();
          console.log(
            `✅ Good posture stable for ${REQUIRED_STABLE_GOOD_FRAMES} frames, auto-saving...`,
          );
          await savePostureResult(
            {
              overall_score: score,
              success: true,
              feedback: `Stable good posture detected (${REQUIRED_STABLE_GOOD_FRAMES} frames)`,
              confidence,
            },
            currentPosture,
          );
          lastSaveTimeRef.current = now;
          autoSaveCountRef.current += 1;
          if (capturedFrame) {
            setLastCapturedPoseImage(capturedFrame);
            setLastCapturedPoseTime(new Date().toLocaleTimeString());
          }

          playSuccess();
          toast.success(
            `✅ ${currentPosture.toUpperCase()}: ${score}% saved (${autoSaveCountRef.current}/${MAX_AUTO_SAVES_PER_SESSION})`,
            {
              duration: 2000,
              icon: "💾",
            },
          );
        } else if (becameStableGood && !canAutoSaveMore) {
          console.log("⛔ Auto-save limit reached for this live session");
        }

        drawIdealPoseGuide();
        drawSkeleton(customKeypoints, score, canvasRef.current);
      } else {
        consecutiveGoodFramesRef.current = 0;
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
  const [cameraError, setCameraError] = useState<CameraError | null>(null);
  const [cameraLoading, setCameraLoading] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanCountdown, setScanCountdown] = useState<number | null>(null);

  // Real-time detection states
  const [isRealTimeActive, setIsRealTimeActive] = useState<boolean>(false);
  const [liveScore, setLiveScore] = useState<number | null>(null);
  const [detectedPosture, setDetectedPosture] = useState<string | null>(null);
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRealTimeActiveRef = useRef<boolean>(false);
  // [SMOOTHNESS V2] Keep skeleton updates fast and scoring updates throttled.
  const SKELETON_LOOP_INTERVAL = 60; // ~16 FPS visual loop
  const SCORE_ANALYSIS_INTERVAL = 300; // ~3 FPS scoring loop
  const scoreAnalysisBusyRef = useRef<boolean>(false);
  const lastScoreAnalysisAtRef = useRef<number>(0);
  const latestSkeletonKeypointsRef = useRef<any[]>([]);
  const latestOverlayScoreRef = useRef<number>(0);
  const lastSaveTimeRef = useRef<number>(0);
  const MIN_SAVE_INTERVAL = 12000; // Minimum 12 seconds between auto-saves
  const consecutiveGoodFramesRef = useRef<number>(0);
  const REQUIRED_STABLE_GOOD_FRAMES = 3;
  const autoSaveCountRef = useRef<number>(0);
  const MAX_AUTO_SAVES_PER_SESSION = 20;
  const lastStatsRefreshRef = useRef<number>(0);
  const STATS_REFRESH_INTERVAL = 30000; // Refresh aggregated stats at most every 30s
  const [weeklyStats, setWeeklyStats] = useState<{
    totalScans: number;
    successfulScans: number;
    averageScore: number;
  } | null>(null);
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

  // Distance calculation states
  const [estimatedDistance, setEstimatedDistance] = useState<number | null>(
    null,
  );
  const [distanceStatus, setDistanceStatus] = useState<
    "too-close" | "optimal" | "too-far" | null
  >(null);
  const [lastCapturedPoseImage, setLastCapturedPoseImage] = useState<
    string | null
  >(null);
  const [lastCapturedPoseTime, setLastCapturedPoseTime] = useState<
    string | null
  >(null);
  const OPTIMAL_DISTANCE = 2.0; // meters
  const DISTANCE_TOLERANCE = 0.5; // meters

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

  // Function to calculate distance from camera based on shoulder width
  const calculateDistance = (
    keypoints: any[],
  ): { distance: number; status: "too-close" | "optimal" | "too-far" } => {
    // Find shoulder keypoints
    const leftShoulder = keypoints.find(
      (kp: any) => kp.name === "left_shoulder",
    );
    const rightShoulder = keypoints.find(
      (kp: any) => kp.name === "right_shoulder",
    );

    if (
      !leftShoulder ||
      !rightShoulder ||
      leftShoulder.confidence < 0.3 ||
      rightShoulder.confidence < 0.3
    ) {
      return { distance: 0, status: "too-far" };
    }

    // Calculate pixel distance between shoulders
    const canvas = canvasRef.current;
    if (!canvas) return { distance: 0, status: "too-far" };

    const shoulderWidthPixels = Math.abs(
      leftShoulder.x * canvas.width - rightShoulder.x * canvas.width,
    );

    // Average human shoulder width: ~40-45cm, we'll use 42cm
    const AVERAGE_SHOULDER_WIDTH_CM = 42;
    const AVERAGE_SHOULDER_WIDTH_M = AVERAGE_SHOULDER_WIDTH_CM / 100;

    // Camera field of view approximation (typical webcam ~70 degrees horizontal)
    const FOV_HORIZONTAL_DEGREES = 70;
    const FOV_HORIZONTAL_RADIANS = (FOV_HORIZONTAL_DEGREES * Math.PI) / 180;

    // Calculate distance using pinhole camera model
    // distance = (real_width * focal_length) / pixel_width
    const focalLengthPixels =
      canvas.width / (2 * Math.tan(FOV_HORIZONTAL_RADIANS / 2));
    const distance =
      (AVERAGE_SHOULDER_WIDTH_M * focalLengthPixels) / shoulderWidthPixels;

    // Determine status based on optimal distance
    let status: "too-close" | "optimal" | "too-far";
    if (distance < OPTIMAL_DISTANCE - DISTANCE_TOLERANCE) {
      status = "too-close";
    } else if (distance > OPTIMAL_DISTANCE + DISTANCE_TOLERANCE) {
      status = "too-far";
    } else {
      status = "optimal";
    }

    return { distance, status };
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
      const successfulScans =
        scanData?.filter((scan) => scan.success).length || 0;
      const averageScore =
        totalScans > 0
          ? scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans
          : 0;

      setWeeklyStats({
        totalScans: totalScans,
        successfulScans: successfulScans,
        averageScore: Number(averageScore.toFixed(1)),
      });

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
  }, []);

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
      let videoConstraints: MediaTrackConstraints = {
        // Remove fixed dimensions to prevent automatic zoom
        // Let the camera use its natural resolution
        // Users can zoom manually using browser/device controls
        width: { min: 320, ideal: 1280, max: 1920 },
        height: { min: 240, ideal: 720, max: 1080 },
        // Allow aspect ratio to be flexible
        frameRate: { ideal: 30 },
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
            width: { ideal: 720 },
            height: { ideal: 1280 },
            aspectRatio: 0.5625,
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

    // Skip drawing overlay for marching pose
    if (currentPosture === "marching") return;

    // Get ideal keypoints for current posture
    const idealKeypoints =
      IDEAL_KEYPOINTS[currentPosture as keyof typeof IDEAL_KEYPOINTS];
    if (!idealKeypoints) return;

    // Define skeleton connections (Custom dataset format: Head, Neck, Shoulders, Elbows, Hands, Hips, Glutes, Knees, Ankles, Feet)
    const connections = [
      [0, 1], // Head to Neck
      [1, 2],
      [1, 5], // Neck to Shoulders
      [2, 3],
      [3, 4], // Left arm
      [5, 6],
      [6, 8], // Right arm
      [1, 7], // Neck to Hips
      [7, 9],
      [7, 10], // Hips to Glutes
      [9, 11],
      [11, 13],
      [13, 15], // Left leg
      [10, 12],
      [12, 14],
      [14, 16], // Right leg
    ];

    // Draw with semi-transparent blue style (guide overlay)
    ctx.globalAlpha = 0.5;

    // Draw connections (skeleton lines)
    ctx.strokeStyle = "#3b82f6"; // blue-500 for guide
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]); // Dashed line for guide
    connections.forEach(([startIdx, endIdx]) => {
      const start = idealKeypoints[startIdx];
      const end = idealKeypoints[endIdx];
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x * displayWidth, start.y * displayHeight);
        ctx.lineTo(end.x * displayWidth, end.y * displayHeight);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]); // Reset dash

    // Draw keypoints
    idealKeypoints.forEach((kp, index) => {
      const x = kp.x * displayWidth;
      const y = kp.y * displayHeight;

      // Color based on keypoint type (Custom dataset: 0=Head, 1=Neck, 2-8=Arms, 7-10=Hips, 11-16=Legs)
      let color = "#3b82f6"; // blue-500 default
      if (index === 0)
        color = "#fbbf24"; // amber-400 for head
      else if (index === 1)
        color = "#f59e0b"; // amber-500 for neck
      else if (index >= 2 && index <= 8)
        color = "#60a5fa"; // blue-400 for arms/hands
      else if (index >= 9 && index <= 10)
        color = "#a855f7"; // purple-500 for glutes
      else if (index >= 11 && index <= 16) color = "#ec4899"; // pink-500 for legs/feet

      // Draw point
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw white border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Reset alpha
    ctx.globalAlpha = 1.0;

    // Add instruction text
    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 20px sans-serif";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 4;
    const text = "MATCH YOUR POSE TO THE BLUE GUIDE";
    const textWidth = ctx.measureText(text).width;
    const textX = (displayWidth - textWidth) / 2;
    const textY = 45;
    ctx.strokeText(text, textX, textY);
    ctx.fillText(text, textX, textY);
  };

  // Legacy real-time loop (hybrid service)
  const runRealTimeDetection = async () => {
    // Check ref immediately at function start
    if (!isRealTimeActiveRef.current || !videoRef.current) {
      console.log("⏹️ Detection loop stopped - not active or no video");
      return;
    }

    try {
      // [SMOOTHNESS V2] Always render guide + freshest skeleton first.
      drawIdealPoseGuide();
      let skeletonDrawn = false;

      if (
        detectorRef.current &&
        videoRef.current &&
        videoRef.current.readyState >= 2
      ) {
        try {
          const poses = await detectorRef.current.estimatePoses(
            videoRef.current,
          );
          if (poses && poses.length > 0) {
            const customKeypoints = mapMoveNetToCustom(
              poses[0].keypoints,
              videoRef.current.videoWidth,
              videoRef.current.videoHeight,
            );

            if (customKeypoints.length > 0) {
              latestSkeletonKeypointsRef.current = customKeypoints;
              drawSkeleton(
                customKeypoints,
                latestOverlayScoreRef.current,
                canvasRef.current,
              );
              skeletonDrawn = true;
            }
          }
        } catch (movenetError) {
          console.warn("MoveNet skeleton render failed:", movenetError);
        }
      }

      if (!skeletonDrawn && latestSkeletonKeypointsRef.current.length > 0) {
        drawSkeleton(
          latestSkeletonKeypointsRef.current,
          latestOverlayScoreRef.current,
          canvasRef.current,
        );
      }

      const now = Date.now();
      const canAnalyzeScore =
        !scoreAnalysisBusyRef.current &&
        now - lastScoreAnalysisAtRef.current >= SCORE_ANALYSIS_INTERVAL;

      // [SMOOTHNESS V2] Score analysis is throttled so it doesn't block skeleton responsiveness.
      if (canAnalyzeScore) {
        const imageData = captureImage();
        if (imageData) {
          scoreAnalysisBusyRef.current = true;
          lastScoreAnalysisAtRef.current = now;

          try {
            const result = await hybridPostureService.analyzePosture(
              imageData,
              currentPosture as "salutation" | "marching" | "attention",
            );

            // Check again after async operation - might have stopped during analysis
            if (!isRealTimeActiveRef.current) {
              console.log("⏹️ Detection stopped during analysis");
              return;
            }

            // Log the actual score from the model
            console.log(
              `📊 Real-time score: ${result.overall_score}% | Source: ${result.source} | Model: ${result.model_used} | Confidence: ${(result.confidence * 100).toFixed(0)}%`,
            );

            // Update live display
            setLiveScore(result.overall_score);
            setLiveConfidence(result.confidence);
            setDetectedPosture(result.posture_status);
            latestOverlayScoreRef.current = result.overall_score;

            // Calculate and update distance
            if (result.keypoints && result.keypoints.length > 0) {
              const { distance, status } = calculateDistance(result.keypoints);
              setEstimatedDistance(distance);
              setDistanceStatus(status);

              // Keep a fallback skeleton source from hybrid/local results.
              if (!skeletonDrawn) {
                const fallbackKeypoints = mapStandardToCustom(result.keypoints);
                if (fallbackKeypoints.length > 0) {
                  latestSkeletonKeypointsRef.current = fallbackKeypoints;
                }
              }
            }

            const timeSinceLastSave = now - lastSaveTimeRef.current;
            const previousGoodFrameCount = consecutiveGoodFramesRef.current;
            const isGoodFrame =
              result.confidence > 0.6 && result.overall_score >= 75;
            if (isGoodFrame) {
              consecutiveGoodFramesRef.current += 1;
            } else {
              consecutiveGoodFramesRef.current = 0;
            }
            const becameStableGood =
              previousGoodFrameCount < REQUIRED_STABLE_GOOD_FRAMES &&
              consecutiveGoodFramesRef.current >= REQUIRED_STABLE_GOOD_FRAMES;
            const canAutoSaveMore =
              autoSaveCountRef.current < MAX_AUTO_SAVES_PER_SESSION;

            if (
              becameStableGood &&
              timeSinceLastSave >= MIN_SAVE_INTERVAL &&
              canAutoSaveMore
            ) {
              const capturedFrame = captureImage();
              console.log("✅ Good posture detected, auto-saving...");
              await savePostureResult(result, currentPosture);
              lastSaveTimeRef.current = now;
              autoSaveCountRef.current += 1;
              if (capturedFrame) {
                setLastCapturedPoseImage(capturedFrame);
                setLastCapturedPoseTime(new Date().toLocaleTimeString());
              }

              // Play success sound and show toast
              playSuccess();
              toast.success(
                `✅ ${currentPosture.toUpperCase()}: ${result.overall_score}% saved (${autoSaveCountRef.current}/${MAX_AUTO_SAVES_PER_SESSION})`,
                {
                  duration: 2000,
                  icon: "💾",
                },
              );
            } else if (becameStableGood && !canAutoSaveMore) {
              console.log("⛔ Auto-save limit reached for this live session");
            }
          } finally {
            scoreAnalysisBusyRef.current = false;
          }
        }
      }
    } catch (error) {
      console.warn("Real-time detection error:", error);
    }

    // Continue loop with faster cadence for smoother skeleton response.
    // Only schedule next frame if still active (check ref again)
    if (isRealTimeActiveRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (isRealTimeActiveRef.current) {
          animationFrameRef.current =
            requestAnimationFrame(runRealTimeDetection);
        }
      }, SKELETON_LOOP_INTERVAL);
    }
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
      setEstimatedDistance(null);
      setDistanceStatus(null);
      setLastCapturedPoseImage(null);
      setLastCapturedPoseTime(null);
      latestSkeletonKeypointsRef.current = [];
      latestOverlayScoreRef.current = 0;
      scoreAnalysisBusyRef.current = false;
      lastScoreAnalysisAtRef.current = 0;
      consecutiveGoodFramesRef.current = 0;
      autoSaveCountRef.current = 0;

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
      setLastCapturedPoseImage(null);
      setLastCapturedPoseTime(null);
      latestSkeletonKeypointsRef.current = [];
      latestOverlayScoreRef.current = 0;
      scoreAnalysisBusyRef.current = false;
      lastScoreAnalysisAtRef.current = 0;
      consecutiveGoodFramesRef.current = 0;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
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
              <span className="text-xl">{isMusicEnabled ? "🔊" : "🔇"}</span>
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

      {/* Posture Selection */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-6 py-4">
          <h2 className="text-lg font-bold text-emerald-400 mb-3">
            📋 SELECT POSTURE TYPE
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(postureTypes).map(([key, posture]) => (
              <button
                key={key}
                onClick={() => {
                  playButtonClick();
                  setCurrentPosture(key);
                  consecutiveGoodFramesRef.current = 0;
                }}
                className={`p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  currentPosture === key
                    ? "bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/25"
                    : "bg-slate-700/50 border-slate-600 hover:border-emerald-400"
                }`}
              >
                <div className="font-bold text-white mb-1">{posture.title}</div>
                <div className="text-xs text-slate-300 mb-2">
                  {posture.instructions}
                </div>
                <div className="flex flex-wrap gap-1">
                  {posture.checkpoints.map((checkpoint, index) => (
                    <span
                      key={index}
                      className="text-xs bg-slate-600/50 px-2 py-1 rounded-md text-slate-300"
                    >
                      {checkpoint}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body Positioning Instructions */}
      <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-700/50">
        <div className="flex items-center justify-center space-x-4 text-xs">
          <div className="flex items-center space-x-1 text-emerald-400">
            <span>📱</span>
            <span>Hold phone vertically</span>
          </div>
          <div className="flex items-center space-x-1 text-blue-400">
            <span>👤</span>
            <span>Position full body in frame</span>
          </div>
          <div className="flex items-center space-x-1 text-yellow-400">
            <span>📏</span>
            <span>2-3 feet from camera</span>
          </div>
          {hasBackCamera && (
            <div className="flex items-center space-x-1 text-purple-400">
              <span>📷</span>
              <span>
                {currentCamera === "front" ? "Front" : "Back"} camera active
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Camera Section */}
      <div className="flex-1 flex flex-col px-4 py-4">
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
                className={`w-full h-full object-contain rounded-lg ${currentCamera === "front" ? "scale-x-[-1]" : ""}`}
              />

              {/* Canvas overlay for dynamic keypoint rendering from dataset */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-contain rounded-lg pointer-events-none ${currentCamera === "front" ? "scale-x-[-1]" : ""}`}
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
                    className={`absolute top-4 right-4 z-10 pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 ${
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

                {/* Manual Zoom Controls */}
                <div className="absolute bottom-4 left-4 z-20 pointer-events-auto bg-slate-900/85 backdrop-blur rounded-lg px-3 py-2 border border-blue-500/30">
                  {zoomSupported ? (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => applyZoom(zoomLevel - zoomRange.step)}
                        className="w-8 h-8 rounded-md bg-blue-600/80 hover:bg-blue-500 text-white font-bold"
                        aria-label="Zoom out"
                        title="Zoom out"
                      >
                        -
                      </button>
                      <input
                        type="range"
                        min={zoomRange.min}
                        max={zoomRange.max}
                        step={zoomRange.step}
                        value={zoomLevel}
                        onChange={(e) => applyZoom(Number(e.target.value))}
                        className="w-24 accent-blue-500"
                        aria-label="Camera zoom"
                      />
                      <button
                        type="button"
                        onClick={() => applyZoom(zoomLevel + zoomRange.step)}
                        className="w-8 h-8 rounded-md bg-blue-600/80 hover:bg-blue-500 text-white font-bold"
                        aria-label="Zoom in"
                        title="Zoom in"
                      >
                        +
                      </button>
                      <span className="text-[10px] text-blue-200 min-w-[34px] text-right">
                        {zoomLevel.toFixed(1)}x
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300">
                      Zoom not supported on this camera
                    </div>
                  )}
                </div>

                {/* Body silhouette guide */}
                <div className="absolute inset-x-4 top-8 bottom-8 border-2 border-emerald-500/30 rounded-full border-dashed">
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-emerald-400 text-xs font-semibold bg-slate-900/80 px-2 py-1 rounded">
                    👤 Position body here
                  </div>
                </div>

                {/* Posture type indicator */}
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 border border-emerald-500/30">
                  <div className="text-emerald-400 text-sm font-bold">
                    {currentPosture === "salutation" && "🫡 SALUTATION POSE"}
                    {currentPosture === "marching" && "🚶 MARCHING POSE"}
                    {currentPosture === "attention" && "🧍 ATTENTION POSE"}
                  </div>
                </div>

                {/* Body alignment guides - Dynamic based on posture type */}
                <div className="absolute inset-0">
                  {/* Canvas overlay handles salutation and attention poses with dataset keypoints */}

                  {/* MARCHING POSE OVERLAY (Current/Default) */}
                  {currentPosture === "marching" && (
                    <>
                      {/* Head guide */}
                      <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
                        <div className="w-16 h-16 border-2 border-emerald-500/40 rounded-full"></div>
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                          <span className="text-[10px] text-emerald-300 font-bold bg-slate-900/80 px-1 rounded">
                            Head forward
                          </span>
                        </div>
                      </div>

                      {/* Shoulder line */}
                      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-24 h-0.5 bg-emerald-500/40"></div>
                      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        <span className="text-[10px] text-emerald-300 font-bold bg-slate-900/80 px-1 rounded">
                          Shoulders level
                        </span>
                      </div>

                      {/* Center line - vertical alignment */}
                      <div className="absolute top-8 bottom-8 left-1/2 transform -translate-x-1/2 w-0.5 bg-emerald-500/30"></div>
                      <div className="absolute top-[40%] left-[52%] whitespace-nowrap">
                        <span className="text-[10px] text-emerald-300 font-bold bg-slate-900/80 px-1 rounded">
                          Upright posture
                        </span>
                      </div>

                      {/* Feet guide */}
                      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                        <div className="w-20 h-4 border-2 border-emerald-500/40 rounded"></div>
                        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                          <span className="text-[10px] text-emerald-300 font-bold bg-slate-900/80 px-1 rounded">
                            Ready stance
                          </span>
                        </div>
                      </div>

                      {/* Arms at sides indicators */}
                      <div className="absolute top-[30%] left-[25%] w-2 h-2 bg-blue-400/60 rounded-full"></div>
                      <div className="absolute top-[30%] right-[25%] w-2 h-2 bg-blue-400/60 rounded-full"></div>
                    </>
                  )}
                </div>

                {/* Real-Time Score Overlay */}
                {isRealTimeActive && liveScore !== null && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl rounded-xl px-6 py-3 border-2 border-purple-500/50 animate-pulse">
                    <div className="text-center">
                      <div
                        className={`text-3xl font-black mb-1 ${
                          liveScore >= 85
                            ? "text-emerald-400"
                            : liveScore >= 75
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {liveScore}%
                      </div>
                      <div className="text-xs text-purple-300 font-bold">
                        {liveScore >= 85
                          ? "🌟 EXCELLENT!"
                          : liveScore >= 75
                            ? "✅ GOOD!"
                            : "⚠️ ADJUST"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {cameraLoading && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-emerald-400 font-bold">
                      🔍 INITIALIZING {currentCamera.toUpperCase()} CAMERA...
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
                        Confidence: {Math.round(scanResult.confidence * 100)}%
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
                              <span className="text-emerald-400 mt-0.5">•</span>
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

      {/* Weekly Statistics Display */}
      {weeklyStats && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 mx-6 mt-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold mb-2 text-center">
            📊 This Week's Progress
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{weeklyStats.totalScans}</div>
              <div className="text-xs opacity-80">Total Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {weeklyStats.successfulScans}
              </div>
              <div className="text-xs opacity-80">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {weeklyStats.averageScore.toFixed(0)}%
              </div>
              <div className="text-xs opacity-80">Avg Score</div>
            </div>
          </div>

          {/* Debug: Manual Weekly Aggregation Button (for testing) */}
          <button
            onClick={async () => {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (session?.user) {
                console.log("🔧 Manual weekly aggregation triggered");
                await aggregateAllWeeklyProgress(session.user.id);
                await fetchWeeklyStats(); // Refresh stats after aggregation
              }
            }}
            className="w-full mt-3 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-medium transition-colors"
          >
            🔧 Force Weekly Aggregation (Debug)
          </button>
        </div>
      )}

      {/* Distance Indicator */}
      {isRealTimeActive &&
        estimatedDistance !== null &&
        estimatedDistance > 0 && (
          <div
            className={`mx-4 mb-2 p-4 rounded-xl border transition-all duration-300 ${
              distanceStatus === "optimal"
                ? "bg-emerald-600/20 border-emerald-500/50 backdrop-blur-xl"
                : distanceStatus === "too-close"
                  ? "bg-orange-600/20 border-orange-500/50 backdrop-blur-xl"
                  : "bg-blue-600/20 border-blue-500/50 backdrop-blur-xl"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-2xl">
                  {distanceStatus === "optimal"
                    ? "✅"
                    : distanceStatus === "too-close"
                      ? "⚠️"
                      : "📏"}
                </span>
                <div>
                  <div className="font-bold text-white text-sm">
                    {distanceStatus === "optimal"
                      ? "Perfect Distance!"
                      : distanceStatus === "too-close"
                        ? "Move Back"
                        : "Come Closer"}
                  </div>
                  <div
                    className={`text-xs ${
                      distanceStatus === "optimal"
                        ? "text-emerald-300"
                        : distanceStatus === "too-close"
                          ? "text-orange-300"
                          : "text-blue-300"
                    }`}
                  >
                    Current: {estimatedDistance.toFixed(1)}m • Optimal:{" "}
                    {OPTIMAL_DISTANCE.toFixed(1)}m
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div
                  className={`text-2xl font-black ${
                    distanceStatus === "optimal"
                      ? "text-emerald-400"
                      : distanceStatus === "too-close"
                        ? "text-orange-400"
                        : "text-blue-400"
                  }`}
                >
                  {distanceStatus === "too-close"
                    ? `+${(estimatedDistance - OPTIMAL_DISTANCE).toFixed(1)}m`
                    : distanceStatus === "too-far"
                      ? `-${(OPTIMAL_DISTANCE - estimatedDistance).toFixed(1)}m`
                      : "✓"}
                </div>
                <div className="text-xs text-slate-400">adjust</div>
              </div>
            </div>
          </div>
        )}

      {/* Real-Time Detection Controls */}
      <div className="relative p-4 mt-auto flex-shrink-0 space-y-3">
        {/* Real-Time Live Score Display */}
        {isRealTimeActive && liveScore !== null && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 backdrop-blur-xl rounded-xl p-4 border border-purple-500/30 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-ping"></div>
                <span className="text-purple-300 font-bold text-sm">
                  LIVE DETECTION
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">
                  {liveScore}%
                </div>
                <div className="text-xs text-purple-300">
                  {detectedPosture} •{" "}
                  {liveConfidence ? Math.round(liveConfidence * 100) : 0}% conf
                </div>
              </div>
            </div>
            {consecutiveGoodFramesRef.current >= REQUIRED_STABLE_GOOD_FRAMES &&
              liveScore >= 75 && (
                <div className="mt-2 text-xs text-emerald-300 flex items-center space-x-1">
                  <span>✅</span>
                  <span>Good posture detected! Auto-saving...</span>
                </div>
              )}
          </div>
        )}
        {isRealTimeActive && lastCapturedPoseImage && (
          <div className="mt-3 bg-slate-800/70 backdrop-blur-xl rounded-xl p-3 border border-emerald-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emerald-300 font-bold">
                📸 LAST AUTO-SAVED FRAME
              </span>
              {lastCapturedPoseTime && (
                <span className="text-[10px] text-slate-400">
                  {lastCapturedPoseTime}
                </span>
              )}
            </div>
            <img
              src={lastCapturedPoseImage}
              alt="Last auto-saved posture frame"
              className="w-full h-44 object-contain rounded-lg border border-slate-600 bg-slate-900/60"
            />
          </div>
        )}

        {/* Toggle Real-Time Detection Button */}
        <button
          onClick={toggleRealTimeDetection}
          disabled={!!cameraError || cameraLoading}
          className={`w-full py-4 rounded-xl font-black text-base transition-all duration-300 shadow-xl border ${
            isRealTimeActive
              ? "bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 border-red-400/50 shadow-red-500/25"
              : cameraError || cameraLoading
                ? "bg-slate-800/50 text-slate-500 cursor-not-allowed border-slate-600/50"
                : "bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:from-purple-600 hover:to-purple-700 active:scale-95 shadow-purple-500/25 border-purple-400/50 hover:shadow-purple-500/40"
          }`}
        >
          {cameraLoading
            ? "⚡ INITIALIZING SCANNER..."
            : cameraError
              ? "❌ SCANNER OFFLINE"
              : isRealTimeActive
                ? "  STOP REAL-TIME DETECTION"
                : "🎯 START REAL-TIME DETECTION"}
        </button>

        {/* Info text */}
        <div className="text-center text-xs text-slate-400">
          {isRealTimeActive ? (
            <span>
              ✨ Continuously analyzing • Auto-saves on stable good posture
              (3-frame lock, 12s cooldown, max 20/session)
            </span>
          ) : (
            <span>
              💡 Real-time detection will automatically save good postures to
              history
            </span>
          )}
        </div>
      </div>

      {/* Posture Guide */}
      <div className="relative px-6 pb-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-emerald-400 mb-4">
            📖 CURRENT POSTURE GUIDE
          </h3>
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-white mb-1">
                {postureTypes[currentPosture].title}
              </h4>
              <p className="text-slate-300 text-sm mb-3">
                {postureTypes[currentPosture].instructions}
              </p>
            </div>
            <div>
              <h5 className="font-bold text-emerald-400 text-sm mb-2">
                KEY CHECKPOINTS:
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {postureTypes[currentPosture].checkpoints.map(
                  (checkpoint, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                      <span className="text-slate-300 text-xs">
                        {checkpoint}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function drawSkeleton(
  customKeypoints: { x: number; y: number; confidence: any; name: string }[],
  score: number,
  canvas: HTMLCanvasElement | null,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

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

  const minDimension = Math.min(displayWidth, displayHeight);
  const dynamicLineWidth = Math.max(2.2, Math.min(4.5, minDimension / 170));
  const dynamicPointRadius = Math.max(4.2, Math.min(7, minDimension / 95));
  const renderThreshold = 0.18;

  // Keep the guide visible, then draw detected pose on top.
  const lineColor =
    score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const pointColor =
    score >= 75 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171";

  // Connections based on your custom 17-point mapping.
  const connections = [
    [0, 1], // Head -> Neck
    [1, 2],
    [1, 5], // Neck -> Shoulders
    [2, 3],
    [3, 4], // Left arm
    [5, 6],
    [6, 8], // Right arm
    [1, 7], // Neck -> Hips
    [7, 9],
    [7, 10], // Hips -> Glutes
    [9, 11],
    [11, 13],
    [13, 15], // Left leg
    [10, 12],
    [12, 14],
    [14, 16], // Right leg
  ];

  // Draw lines first.
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
    ctx.moveTo(start.x * displayWidth, start.y * displayHeight);
    ctx.lineTo(end.x * displayWidth, end.y * displayHeight);
    ctx.stroke();
  });

  // Draw keypoints on top.
  ctx.shadowBlur = 0;
  customKeypoints.forEach((kp) => {
    if (!kp || kp.confidence < renderThreshold) return;
    const x = kp.x * displayWidth;
    const y = kp.y * displayHeight;
    ctx.fillStyle = pointColor;
    ctx.beginPath();
    ctx.arc(x, y, dynamicPointRadius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.2, dynamicLineWidth * 0.45);
    ctx.stroke();
  });
  ctx.restore();
}

function calculateScore(
  customKeypoints: { x: number; y: number; confidence: any; name: string }[],
  ideal: { x: number; y: number; confidence: number; name: string }[],
  postureType: string,
): number {
  if (customKeypoints.length === 0 || ideal.length === 0) {
    return 0;
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
    return 0;
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
    const saluteRequiredVisible =
      visible(RIGHT_HAND, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3) &&
      visible(HEAD, 0.3) &&
      visible(RIGHT_ELBOW, 0.3);
    if (!saluteRequiredVisible) {
      scoreCap = Math.min(scoreCap, 45);
    }

    if (
      visible(RIGHT_HAND, 0.35) &&
      visible(HEAD, 0.35) &&
      visible(RIGHT_SHOULDER, 0.35)
    ) {
      const rightHand = kp(RIGHT_HAND);
      const head = kp(HEAD);
      const rightShoulder = kp(RIGHT_SHOULDER);
      const rightHip = visible(RIGHT_HIP, 0.3)
        ? kp(RIGHT_HIP)
        : kp(HIPS_CENTER);

      const handRaised = rightHand.y < rightShoulder.y - 0.03;
      const handNearForehead =
        Math.abs(rightHand.x - head.x) < (isSideView ? 0.25 : 0.15) &&
        Math.abs(rightHand.y - head.y) < 0.14;
      const looksLikeAttention =
        rightHand.y > rightHip.y - 0.02 &&
        Math.abs(rightHand.x - rightHip.x) < 0.16;

      if (handRaised) ruleScore += 35;
      if (handNearForehead) ruleScore += 40;
      if (!looksLikeAttention) ruleScore += 25;

      // If required salute hand signature is missing, keep score low.
      if (!handRaised || !handNearForehead) {
        scoreCap = Math.min(scoreCap, 35);
      }

      // Strong penalty when the pose clearly looks like attention.
      if (looksLikeAttention) {
        scoreCap = Math.min(scoreCap, 20);
      }
    } else {
      scoreCap = Math.min(scoreCap, 25);
    }

    if (visible(RIGHT_ELBOW, 0.3) && visible(RIGHT_SHOULDER, 0.3)) {
      const rightElbow = kp(RIGHT_ELBOW);
      const rightShoulder = kp(RIGHT_SHOULDER);
      const elbowRaised = rightElbow.y <= rightShoulder.y + 0.07;
      if (elbowRaised) ruleScore = Math.min(100, ruleScore + 15);
      if (!elbowRaised) {
        scoreCap = Math.min(scoreCap, 45);
      }
    }
  } else if (postureType === "attention") {
    let attentionSignatureReliable = false;
    const attentionRequiredVisible =
      visible(LEFT_HAND, 0.3) &&
      visible(RIGHT_HAND, 0.3) &&
      visible(HIPS_CENTER, 0.3) &&
      visible(RIGHT_SHOULDER, 0.3);
    if (!attentionRequiredVisible) {
      scoreCap = Math.min(scoreCap, 45);
    }

    // Fail-safe salute rejection for attention:
    // if right hand is clearly raised near/above shoulder, this cannot score high.
    if (visible(RIGHT_HAND, 0.3) && visible(RIGHT_SHOULDER, 0.3)) {
      const rightHand = kp(RIGHT_HAND);
      const rightShoulder = kp(RIGHT_SHOULDER);
      const rightHandRaised = rightHand.y < rightShoulder.y - 0.03;
      if (rightHandRaised) {
        scoreCap = Math.min(scoreCap, 30);
      }
    }

    if (attentionRequiredVisible) {
      attentionSignatureReliable = true;
      const leftHand = kp(LEFT_HAND);
      const rightHand = kp(RIGHT_HAND);
      const hips = kp(HIPS_CENTER);
      const rightShoulder = kp(RIGHT_SHOULDER);
      const handsAtSides =
        leftHand.y > hips.y - 0.02 && rightHand.y > hips.y - 0.02;
      const rightHandRaised = rightHand.y < rightShoulder.y - 0.03;
      const rightHandDown = !rightHandRaised;

      if (handsAtSides) ruleScore += 55;
      if (rightHandDown) ruleScore += 25;
      if (visible(HEAD, 0.3)) {
        const head = kp(HEAD);
        const bodyCenterX = hips.x;
        if (Math.abs(head.x - bodyCenterX) < (isSideView ? 0.12 : 0.08)) {
          ruleScore += 20;
        }
      }

      if (!handsAtSides) {
        scoreCap = Math.min(scoreCap, 60);
      }
      if (rightHandRaised) {
        scoreCap = Math.min(scoreCap, 40);
      }
    }

    // If core attention landmarks are not reliable, prevent false "good" labels.
    if (!attentionSignatureReliable) {
      scoreCap = Math.min(scoreCap, 50);
    }
  } else if (postureType === "marching") {
    const marchingRequiredVisible =
      visible(LEFT_HIP, 0.3) &&
      visible(RIGHT_HIP, 0.3) &&
      visible(LEFT_KNEE, 0.3) &&
      visible(RIGHT_KNEE, 0.3) &&
      visible(LEFT_ANKLE, 0.3) &&
      visible(RIGHT_ANKLE, 0.3);
    if (!marchingRequiredVisible) {
      scoreCap = Math.min(scoreCap, 45);
    }

    if (
      visible(LEFT_HIP, 0.3) &&
      visible(RIGHT_HIP, 0.3) &&
      visible(LEFT_KNEE, 0.3) &&
      visible(RIGHT_KNEE, 0.3) &&
      visible(LEFT_ANKLE, 0.3) &&
      visible(RIGHT_ANKLE, 0.3)
    ) {
      const leftKneeLift = kp(LEFT_HIP).y - kp(LEFT_KNEE).y;
      const rightKneeLift = kp(RIGHT_HIP).y - kp(RIGHT_KNEE).y;
      const oneLegRaised =
        (leftKneeLift > 0.06 && rightKneeLift <= 0.06) ||
        (rightKneeLift > 0.06 && leftKneeLift <= 0.06);
      const anklesApart = Math.abs(kp(LEFT_ANKLE).x - kp(RIGHT_ANKLE).x) > 0.03;

      if (oneLegRaised) ruleScore += 70;
      if (anklesApart) ruleScore += 15;
      if (visible(HEAD, 0.3) && visible(HIPS_CENTER, 0.3)) {
        if (Math.abs(kp(HEAD).x - kp(HIPS_CENTER).x) < 0.1) {
          ruleScore += 15;
        }
      }

      if (!oneLegRaised) {
        scoreCap = Math.min(scoreCap, 50);
      }
    }
  }

  // For side-view poses, rely more on posture rules than front-view template distance.
  if (isSideView && ruleScore > 0) {
    score = score * 0.35 + ruleScore * 0.65;
  } else if (ruleScore > 0) {
    score = score * 0.7 + ruleScore * 0.3;
  }

  score = Math.min(score, scoreCap);

  return Math.round(score);
}
