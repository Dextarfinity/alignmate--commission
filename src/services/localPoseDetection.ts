/**
 * Local Pose Detection Service
 * Uses ONNX Runtime Web to run YOLOv8 pose models locally
 * Works offline in both web and mobile (Ionic Capacitor)
 */

import * as ort from "onnxruntime-web";

// Configure ONNX Runtime for web environment
ort.env.wasm.wasmPaths =
  "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/";

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name: string;
}

export interface PostureAnalysis {
  success: boolean;
  overall_score: number;
  raw_score: number;
  posture_status: string;
  feedback: string;
  confidence: number;
  keypoints: PoseKeypoint[];
  recommendations: string[];
  timestamp: string;
  model_used: string;
}

export interface ModelConfig {
  name: string;
  path: string;
  inputSize: number;
  confidence_threshold: number;
}

// YOLO v8 pose keypoint names (17 keypoints in COCO format)
const KEYPOINT_NAMES = [
  "nose",
  "left_eye",
  "right_eye",
  "left_ear",
  "right_ear",
  "left_shoulder",
  "right_shoulder",
  "left_elbow",
  "right_elbow",
  "left_wrist",
  "right_wrist",
  "left_hip",
  "right_hip",
  "left_knee",
  "right_knee",
  "left_ankle",
  "right_ankle",
];

type TemplatePostureType = "attention" | "salutation" | "marching";
type TemplatePoint = { x: number; y: number };
type TemplateKeypoints = Record<string, TemplatePoint>;
type TemplateVariant = {
  id: string;
  weight: number;
  keypoints: TemplateKeypoints;
};

const BASE_TEMPLATE_KEYPOINTS: Record<
  Exclude<TemplatePostureType, "marching">,
  TemplateKeypoints
> = {
  attention: {
    nose: { x: 0.5, y: 0.14 },
    left_eye: { x: 0.485, y: 0.13 },
    right_eye: { x: 0.515, y: 0.13 },
    left_ear: { x: 0.465, y: 0.14 },
    right_ear: { x: 0.535, y: 0.14 },
    left_shoulder: { x: 0.43, y: 0.21 },
    right_shoulder: { x: 0.57, y: 0.21 },
    left_elbow: { x: 0.43, y: 0.33 },
    right_elbow: { x: 0.57, y: 0.33 },
    left_wrist: { x: 0.43, y: 0.46 },
    right_wrist: { x: 0.57, y: 0.46 },
    left_hip: { x: 0.46, y: 0.46 },
    right_hip: { x: 0.54, y: 0.46 },
    left_knee: { x: 0.47, y: 0.66 },
    right_knee: { x: 0.53, y: 0.66 },
    left_ankle: { x: 0.48, y: 0.87 },
    right_ankle: { x: 0.52, y: 0.87 },
  },
  salutation: {
    nose: { x: 0.5, y: 0.14 },
    left_eye: { x: 0.485, y: 0.13 },
    right_eye: { x: 0.515, y: 0.13 },
    left_ear: { x: 0.465, y: 0.14 },
    right_ear: { x: 0.535, y: 0.14 },
    left_shoulder: { x: 0.43, y: 0.21 },
    right_shoulder: { x: 0.57, y: 0.21 },
    left_elbow: { x: 0.43, y: 0.33 },
    right_elbow: { x: 0.66, y: 0.21 },
    left_wrist: { x: 0.43, y: 0.46 },
    right_wrist: { x: 0.585, y: 0.145 },
    left_hip: { x: 0.46, y: 0.46 },
    right_hip: { x: 0.54, y: 0.46 },
    left_knee: { x: 0.47, y: 0.66 },
    right_knee: { x: 0.53, y: 0.66 },
    left_ankle: { x: 0.48, y: 0.87 },
    right_ankle: { x: 0.52, y: 0.87 },
  },
};

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
    morphed[name] = {
      x: clamp(centerX + deltaX * widthScale + shiftX),
      y: point.y,
    };
  }

  return morphed;
};

const mirrorTemplateHorizontally = (
  template: TemplateKeypoints,
): TemplateKeypoints => {
  const mirrored: TemplateKeypoints = {};
  for (const name of KEYPOINT_NAMES) {
    const point = template[name];
    const mirrorX = clamp(1 - point.x);
    const isLeft = name.startsWith("left_");
    const isRight = name.startsWith("right_");
    const targetName = isLeft
      ? name.replace("left_", "right_")
      : isRight
        ? name.replace("right_", "left_")
        : name;
    mirrored[targetName] = {
      x: mirrorX,
      y: point.y,
    };
  }
  return mirrored;
};

const ATTENTION_TEMPLATE_VARIANTS: TemplateVariant[] = (() => {
  const base = BASE_TEMPLATE_KEYPOINTS.attention;
  const variants: Array<{
    id: string;
    weight: number;
    widthScale: number;
    shiftX: number;
  }> = [
    { id: "front_strict", weight: 1.0, widthScale: 1.0, shiftX: 0.0 },
    { id: "front_narrow", weight: 0.95, widthScale: 0.9, shiftX: 0.0 },
    { id: "front_wide", weight: 0.9, widthScale: 1.1, shiftX: 0.0 },
    { id: "left_oblique", weight: 0.86, widthScale: 0.78, shiftX: -0.02 },
    { id: "right_oblique", weight: 0.86, widthScale: 0.78, shiftX: 0.02 },
    { id: "left_profile", weight: 0.72, widthScale: 0.58, shiftX: -0.032 },
    { id: "right_profile", weight: 0.72, widthScale: 0.58, shiftX: 0.032 },
  ];

  return variants.map((variant) => ({
    id: variant.id,
    weight: variant.weight,
    keypoints: morphTemplateForView(base, {
      widthScale: variant.widthScale,
      shiftX: variant.shiftX,
    }),
  }));
})();

const MARCHING_LEFT_BASE_TEMPLATE: TemplateKeypoints = {
  nose: { x: 0.5, y: 0.14 },
  left_eye: { x: 0.485, y: 0.13 },
  right_eye: { x: 0.515, y: 0.13 },
  left_ear: { x: 0.465, y: 0.14 },
  right_ear: { x: 0.535, y: 0.14 },
  left_shoulder: { x: 0.43, y: 0.21 },
  right_shoulder: { x: 0.57, y: 0.21 },
  left_elbow: { x: 0.43, y: 0.33 },
  right_elbow: { x: 0.57, y: 0.33 },
  left_wrist: { x: 0.43, y: 0.46 },
  right_wrist: { x: 0.57, y: 0.46 },
  left_hip: { x: 0.46, y: 0.46 },
  right_hip: { x: 0.54, y: 0.46 },
  left_knee: { x: 0.47, y: 0.58 },
  right_knee: { x: 0.53, y: 0.66 },
  left_ankle: { x: 0.47, y: 0.7 },
  right_ankle: { x: 0.53, y: 0.87 },
};

const MARCHING_RIGHT_BASE_TEMPLATE: TemplateKeypoints =
  mirrorTemplateHorizontally(MARCHING_LEFT_BASE_TEMPLATE);

const buildMarchingPhaseVariants = (
  phaseId: "left_raise" | "right_raise",
  baseTemplate: TemplateKeypoints,
): TemplateVariant[] => {
  const variants: Array<{
    id: string;
    weight: number;
    widthScale: number;
    shiftX: number;
  }> = [
    {
      id: `${phaseId}_front_strict`,
      weight: 1.0,
      widthScale: 1.0,
      shiftX: 0.0,
    },
    {
      id: `${phaseId}_front_soft`,
      weight: 0.95,
      widthScale: 0.92,
      shiftX: 0.0,
    },
    {
      id: `${phaseId}_left_oblique`,
      weight: 0.86,
      widthScale: 0.8,
      shiftX: -0.02,
    },
    {
      id: `${phaseId}_right_oblique`,
      weight: 0.86,
      widthScale: 0.8,
      shiftX: 0.02,
    },
    {
      id: `${phaseId}_left_profile`,
      weight: 0.7,
      widthScale: 0.6,
      shiftX: -0.03,
    },
    {
      id: `${phaseId}_right_profile`,
      weight: 0.7,
      widthScale: 0.6,
      shiftX: 0.03,
    },
  ];

  return variants.map((variant) => ({
    id: variant.id,
    weight: variant.weight,
    keypoints: morphTemplateForView(baseTemplate, {
      widthScale: variant.widthScale,
      shiftX: variant.shiftX,
    }),
  }));
};

const MARCHING_TEMPLATE_VARIANTS: TemplateVariant[] = [
  ...buildMarchingPhaseVariants("left_raise", MARCHING_LEFT_BASE_TEMPLATE),
  ...buildMarchingPhaseVariants("right_raise", MARCHING_RIGHT_BASE_TEMPLATE),
];

const TEMPLATE_KEYPOINT_BANK: Record<TemplatePostureType, TemplateVariant[]> = {
  attention: ATTENTION_TEMPLATE_VARIANTS,
  salutation: [
    {
      id: "salutation_front",
      weight: 1,
      keypoints: BASE_TEMPLATE_KEYPOINTS.salutation,
    },
  ],
  marching: MARCHING_TEMPLATE_VARIANTS,
};

class LocalPoseDetectionService {
  private session: ort.InferenceSession | null = null;
  private modelConfig: ModelConfig | null = null;
  private isLoading = false;
  private loadError: Error | null = null;

  /**
   * Available models (from smallest/fastest to largest/most accurate)
   */
  private availableModels: ModelConfig[] = [
    {
      name: "yolov8n-pose",
      path: "/models/yolov8n-pose.onnx",
      inputSize: 640,
      confidence_threshold: 0.45,
    },
    {
      name: "yolov8s-pose",
      path: "/models/yolov8s-pose.onnx",
      inputSize: 640,
      confidence_threshold: 0.5,
    },
  ];

  /**
   * Load ONNX model (with fallback support)
   */
  async loadModel(preferredModel: "nano" | "small" = "small"): Promise<void> {
    if (this.session) {
      console.log("✅ Model already loaded:", this.modelConfig?.name);
      return;
    }

    if (this.isLoading) {
      console.log("⏳ Model loading in progress...");
      return;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      // Select model based on preference
      const modelIndex = preferredModel === "nano" ? 0 : 1;
      let config = this.availableModels[modelIndex];

      console.log(`🔄 Loading local pose model: ${config.name}...`);

      // Try to load the preferred model
      try {
        const session = await ort.InferenceSession.create(config.path, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });

        this.session = session;
        this.modelConfig = config;

        console.log(`✅ Model loaded successfully: ${config.name}`);
        console.log(`📊 Model info:`, {
          inputNames: session.inputNames,
          outputNames: session.outputNames,
          inputSize: config.inputSize,
        });
      } catch (error) {
        console.warn(`⚠️ Failed to load ${config.name}, trying fallback...`);

        // Try the other model as fallback
        const fallbackIndex = modelIndex === 0 ? 1 : 0;
        config = this.availableModels[fallbackIndex];

        const session = await ort.InferenceSession.create(config.path, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });

        this.session = session;
        this.modelConfig = config;

        console.log(`✅ Fallback model loaded: ${config.name}`);
      }
    } catch (error) {
      this.loadError = error as Error;
      console.error("❌ Failed to load any pose model:", error);
      throw new Error(`Failed to load pose detection model: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Check if model is ready
   */
  isModelReady(): boolean {
    return this.session !== null;
  }

  /**
   * Get model status
   */
  getModelStatus(): {
    loaded: boolean;
    loading: boolean;
    error: string | null;
    model: string | null;
  } {
    return {
      loaded: this.session !== null,
      loading: this.isLoading,
      error: this.loadError?.message || null,
      model: this.modelConfig?.name || null,
    };
  }

  /**
   * Preprocess image for YOLO model
   */
  private preprocessImage(
    imageData: ImageData,
    inputSize: number,
  ): Float32Array {
    const { width, height } = imageData;

    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(inputSize / width, inputSize / height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);

    // Create canvas for resizing
    const canvas = document.createElement("canvas");
    canvas.width = inputSize;
    canvas.height = inputSize;
    const ctx = canvas.getContext("2d")!;

    // Fill with gray background
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, inputSize, inputSize);

    // Calculate offset to center the image
    const offsetX = (inputSize - newWidth) / 2;
    const offsetY = (inputSize - newHeight) / 2;

    // Create temporary canvas with original image
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d")!;
    tempCtx.putImageData(imageData, 0, 0);

    // Draw resized image
    ctx.drawImage(tempCanvas, offsetX, offsetY, newWidth, newHeight);

    // Get resized image data
    const resizedData = ctx.getImageData(0, 0, inputSize, inputSize);

    // Convert to Float32Array in CHW format (channels, height, width)
    // Normalize to [0, 1]
    const float32Data = new Float32Array(3 * inputSize * inputSize);

    for (let i = 0; i < resizedData.data.length; i += 4) {
      const pixelIndex = i / 4;
      const y = Math.floor(pixelIndex / inputSize);
      const x = pixelIndex % inputSize;

      // RGB values normalized to [0, 1]
      float32Data[y * inputSize + x] = resizedData.data[i] / 255.0; // R
      float32Data[inputSize * inputSize + y * inputSize + x] =
        resizedData.data[i + 1] / 255.0; // G
      float32Data[2 * inputSize * inputSize + y * inputSize + x] =
        resizedData.data[i + 2] / 255.0; // B
    }

    return float32Data;
  }

  /**
   * Run pose detection on image
   */
  async detectPose(imageData: ImageData): Promise<PoseKeypoint[]> {
    if (!this.session || !this.modelConfig) {
      throw new Error("Model not loaded. Call loadModel() first.");
    }

    const { inputSize, confidence_threshold } = this.modelConfig;

    // Preprocess image
    const inputTensor = this.preprocessImage(imageData, inputSize);

    // Create input tensor
    const tensor = new ort.Tensor("float32", inputTensor, [
      1,
      3,
      inputSize,
      inputSize,
    ]);

    // Run inference
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensor;

    const results = await this.session.run(feeds);
    const output = results[this.session.outputNames[0]];

    // Parse YOLO pose output
    // Output shape: [batch, 56, num_boxes]
    // 56 = 4 (bbox) + 1 (obj_conf) + 17*3 (keypoints x,y,conf)
    const outputData = output.data as Float32Array;
    const numBoxes = output.dims[2] || 0;

    // Find box with highest confidence
    let maxConf = 0;
    let bestBoxIndex = -1;

    for (let i = 0; i < numBoxes; i++) {
      const conf = outputData[4 * numBoxes + i]; // objectness score
      if (conf > maxConf && conf > confidence_threshold) {
        maxConf = conf;
        bestBoxIndex = i;
      }
    }

    // Extract keypoints from best detection
    const keypoints: PoseKeypoint[] = [];

    if (bestBoxIndex >= 0) {
      // Keypoints start at index 5 (after bbox and conf)
      const keypointOffset = 5;

      for (let k = 0; k < 17; k++) {
        const baseIdx = (keypointOffset + k * 3) * numBoxes + bestBoxIndex;

        const x = outputData[baseIdx];
        const y = outputData[baseIdx + numBoxes];
        const conf = outputData[baseIdx + 2 * numBoxes];

        keypoints.push({
          x: x / inputSize, // Normalize to [0, 1]
          y: y / inputSize,
          confidence: conf,
          name: KEYPOINT_NAMES[k],
        });
      }
    }

    return keypoints;
  }

  /**
   * Analyze posture from base64 image
   */
  async analyzePosture(
    base64Image: string,
    postureType: "salutation" | "marching" | "attention" = "salutation",
  ): Promise<PostureAnalysis> {
    try {
      // Ensure model is loaded
      if (!this.session) {
        await this.loadModel("nano"); // Use fastest model by default
      }

      // Convert base64 to ImageData
      const imageData = await this.base64ToImageData(base64Image);

      // Detect pose
      const keypoints = await this.detectPose(imageData);

      // Analyze posture based on keypoints
      const analysis = this.analyzePoseKeypoints(keypoints, postureType);

      return {
        ...analysis,
        keypoints,
        timestamp: new Date().toISOString(),
        model_used: this.modelConfig?.name || "unknown",
      };
    } catch (error) {
      console.error("Error in analyzePosture:", error);

      // Return fallback result
      return this.getFallbackAnalysis(postureType);
    }
  }

  /**
   * Convert base64 image to ImageData
   */
  private async base64ToImageData(base64: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  /**
   * Build compact, normalized pose descriptor used for cosine similarity.
   * Uses segment directions + a few relative offsets tied to pose intent.
   */
  private buildPoseDescriptorVector(
    keypoints: PoseKeypoint[],
  ): number[] | null {
    const kpByName = new Map(keypoints.map((kp) => [kp.name, kp]));
    const get = (name: string, min = 0.25): PoseKeypoint | null => {
      const kp = kpByName.get(name);
      return kp && kp.confidence >= min ? kp : null;
    };

    const leftShoulder = get("left_shoulder");
    const rightShoulder = get("right_shoulder");
    const leftElbow = get("left_elbow");
    const rightElbow = get("right_elbow");
    const leftWrist = get("left_wrist");
    const rightWrist = get("right_wrist");
    const leftHip = get("left_hip");
    const rightHip = get("right_hip");
    const leftKnee = get("left_knee");
    const rightKnee = get("right_knee");
    const leftAnkle = get("left_ankle");
    const rightAnkle = get("right_ankle");

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftElbow ||
      !rightElbow ||
      !leftWrist ||
      !rightWrist ||
      !leftHip ||
      !rightHip ||
      !leftKnee ||
      !rightKnee ||
      !leftAnkle ||
      !rightAnkle
    ) {
      return null;
    }

    const nose = get("nose");
    const leftEye = get("left_eye");
    const rightEye = get("right_eye");
    const leftEar = get("left_ear");
    const rightEar = get("right_ear");

    const headCandidates = [nose, leftEye, rightEye, leftEar, rightEar].filter(
      (kp): kp is PoseKeypoint => Boolean(kp),
    );
    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
    };
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
    };
    const head = headCandidates.length
      ? {
          x:
            headCandidates.reduce((sum, kp) => sum + kp.x, 0) /
            headCandidates.length,
          y:
            headCandidates.reduce((sum, kp) => sum + kp.y, 0) /
            headCandidates.length,
        }
      : { x: shoulderCenter.x, y: shoulderCenter.y - 0.12 };

    const safeNorm = (dx: number, dy: number): [number, number] => {
      const length = Math.hypot(dx, dy);
      if (length < 1e-6) return [0, 0];
      return [dx / length, dy / length];
    };

    const segment = (
      a: PoseKeypoint | { x: number; y: number },
      b: PoseKeypoint | { x: number; y: number },
    ): [number, number] => safeNorm(b.x - a.x, b.y - a.y);

    const torsoLength = Math.max(
      0.05,
      Math.hypot(
        hipCenter.x - shoulderCenter.x,
        hipCenter.y - shoulderCenter.y,
      ),
    );
    const shoulderWidth = Math.max(
      0.03,
      Math.hypot(
        rightShoulder.x - leftShoulder.x,
        rightShoulder.y - leftShoulder.y,
      ),
    );

    const descriptor: number[] = [];
    descriptor.push(...segment(shoulderCenter, hipCenter)); // torso direction
    descriptor.push(...segment(leftShoulder, rightShoulder)); // shoulder line
    descriptor.push(...segment(leftShoulder, leftElbow));
    descriptor.push(...segment(leftElbow, leftWrist));
    descriptor.push(...segment(rightShoulder, rightElbow));
    descriptor.push(...segment(rightElbow, rightWrist));
    descriptor.push(...segment(leftHip, leftKnee));
    descriptor.push(...segment(leftKnee, leftAnkle));
    descriptor.push(...segment(rightHip, rightKnee));
    descriptor.push(...segment(rightKnee, rightAnkle));

    // Relative offsets encode "hand at side" and "salute hand near head" cues.
    descriptor.push((rightWrist.x - head.x) / torsoLength);
    descriptor.push((rightWrist.y - head.y) / torsoLength);
    descriptor.push((leftWrist.x - leftHip.x) / torsoLength);
    descriptor.push((leftWrist.y - leftHip.y) / torsoLength);
    descriptor.push((rightWrist.x - rightHip.x) / torsoLength);
    descriptor.push((rightWrist.y - rightHip.y) / torsoLength);

    // Include stance spread proxy.
    descriptor.push(Math.abs(leftAnkle.x - rightAnkle.x) / shoulderWidth);

    return descriptor;
  }

  private getTemplateDescriptorVectors(
    postureType: TemplatePostureType,
  ): Array<{ id: string; weight: number; descriptor: number[] }> {
    const variants = TEMPLATE_KEYPOINT_BANK[postureType];

    return variants
      .map((variant) => {
        const templateKeypoints: PoseKeypoint[] = KEYPOINT_NAMES.map((name) => {
          const point = variant.keypoints[name];
          return {
            x: point.x,
            y: point.y,
            confidence: 1,
            name,
          };
        });

        const descriptor = this.buildPoseDescriptorVector(templateKeypoints);
        if (!descriptor || descriptor.length === 0) {
          return null;
        }

        return {
          id: variant.id,
          weight: variant.weight,
          descriptor,
        };
      })
      .filter(
        (
          item,
        ): item is {
          id: string;
          weight: number;
          descriptor: number[];
        } => Boolean(item),
      );
  }

  private cosineSimilarity(a: number[], b: number[]): number | null {
    if (!a.length || !b.length || a.length !== b.length) {
      return null;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    if (magA < 1e-12 || magB < 1e-12) {
      return null;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  private blendWithCosineTemplateScore(
    keypoints: PoseKeypoint[],
    postureType: "salutation" | "marching" | "attention",
    baseScore: number,
    avgConfidence: number,
  ): { score: number; cosineScore: number | null } {
    if (
      postureType !== "attention" &&
      postureType !== "salutation" &&
      postureType !== "marching"
    ) {
      return { score: baseScore, cosineScore: null };
    }

    const currentDescriptor = this.buildPoseDescriptorVector(keypoints);
    if (!currentDescriptor) {
      return { score: baseScore, cosineScore: null };
    }

    const templateDescriptors = this.getTemplateDescriptorVectors(postureType);
    if (templateDescriptors.length === 0) {
      return { score: baseScore, cosineScore: null };
    }

    const matches = templateDescriptors
      .map((template) => {
        const cosine = this.cosineSimilarity(
          currentDescriptor,
          template.descriptor,
        );
        if (cosine === null) return null;
        return {
          cosine,
          weightedCosine: cosine * template.weight,
        };
      })
      .filter(
        (
          item,
        ): item is {
          cosine: number;
          weightedCosine: number;
        } => Boolean(item),
      )
      .sort((a, b) => b.weightedCosine - a.weightedCosine);

    if (matches.length === 0) {
      return { score: baseScore, cosineScore: null };
    }

    const bestCosine = matches[0].cosine;
    const topWindow = matches.slice(0, Math.min(3, matches.length));
    const topAverage =
      topWindow.reduce((sum, match) => sum + match.cosine, 0) /
      topWindow.length;
    const fusedCosine = bestCosine * 0.75 + topAverage * 0.25;

    const cosineScore = Math.round(
      Math.max(0, Math.min(100, ((fusedCosine + 1) / 2) * 100)),
    );

    const cosineWeight =
      postureType === "attention"
        ? avgConfidence >= 0.7
          ? 0.52
          : avgConfidence >= 0.5
            ? 0.4
            : 0.26
        : postureType === "marching"
          ? avgConfidence >= 0.7
            ? 0.44
            : avgConfidence >= 0.5
              ? 0.32
              : 0.2
          : avgConfidence >= 0.7
            ? 0.35
            : avgConfidence >= 0.5
              ? 0.25
              : 0.15;
    const blendedScore = Math.round(
      baseScore * (1 - cosineWeight) + cosineScore * cosineWeight,
    );

    return { score: blendedScore, cosineScore };
  }

  /**
   * Analyze pose keypoints for specific posture type - COMPREHENSIVE ANALYSIS
   */
  private analyzePoseKeypoints(
    keypoints: PoseKeypoint[],
    postureType: "salutation" | "marching" | "attention",
  ): Omit<PostureAnalysis, "keypoints" | "timestamp" | "model_used"> {
    if (keypoints.length === 0) {
      return this.getFallbackAnalysis(postureType);
    }

    // Calculate average confidence of visible keypoints
    const visibleKeypoints = keypoints.filter((kp) => kp.confidence > 0.3);
    const avgConfidence =
      visibleKeypoints.length > 0
        ? visibleKeypoints.reduce((sum, kp) => sum + kp.confidence, 0) /
          visibleKeypoints.length
        : 0;

    // If no visible keypoints or very low confidence, return zero score
    if (visibleKeypoints.length < 5 || avgConfidence < 0.3) {
      return this.getFallbackAnalysis(postureType);
    }

    // Extract keypoints
    const nose = keypoints.find((kp) => kp.name === "nose");
    const leftEye = keypoints.find((kp) => kp.name === "left_eye");
    const rightEye = keypoints.find((kp) => kp.name === "right_eye");
    const leftEar = keypoints.find((kp) => kp.name === "left_ear");
    const rightEar = keypoints.find((kp) => kp.name === "right_ear");
    const leftShoulder = keypoints.find((kp) => kp.name === "left_shoulder");
    const rightShoulder = keypoints.find((kp) => kp.name === "right_shoulder");
    const leftElbow = keypoints.find((kp) => kp.name === "left_elbow");
    const rightElbow = keypoints.find((kp) => kp.name === "right_elbow");
    const leftWrist = keypoints.find((kp) => kp.name === "left_wrist");
    const rightWrist = keypoints.find((kp) => kp.name === "right_wrist");
    const leftHip = keypoints.find((kp) => kp.name === "left_hip");
    const rightHip = keypoints.find((kp) => kp.name === "right_hip");
    const leftKnee = keypoints.find((kp) => kp.name === "left_knee");
    const rightKnee = keypoints.find((kp) => kp.name === "right_knee");
    const leftAnkle = keypoints.find((kp) => kp.name === "left_ankle");
    const rightAnkle = keypoints.find((kp) => kp.name === "right_ankle");

    let score = 0;
    let scoreCap = 100;
    const feedback: string[] = [];
    const recommendations: string[] = [];
    // [SCORING UPGRADE] Track whether critical posture signatures are all satisfied.
    // If true under high-confidence/full-body conditions, we explicitly award 100.
    let perfectCriticalChecksPassed = false;

    const isVisible = (
      kp: PoseKeypoint | undefined,
      min = 0.35,
    ): kp is PoseKeypoint => Boolean(kp && kp.confidence >= min);

    const facePoints = [nose, leftEye, rightEye, leftEar, rightEar].filter(
      (kp): kp is PoseKeypoint => Boolean(kp && kp.confidence > 0.25),
    );
    const headPoint: PoseKeypoint | undefined =
      facePoints.length > 0
        ? {
            x:
              facePoints.reduce((sum, point) => sum + point.x, 0) /
              facePoints.length,
            y:
              facePoints.reduce((sum, point) => sum + point.y, 0) /
              facePoints.length,
            confidence:
              facePoints.reduce((sum, point) => sum + point.confidence, 0) /
              facePoints.length,
            name: "head",
          }
        : undefined;

    const addScore = (points: number, goodText: string, recText?: string) => {
      score += points;
      if (goodText) {
        feedback.push(goodText);
      }
      if (recText) {
        recommendations.push(recText);
      }
    };

    const calculateAngle = (
      a: PoseKeypoint,
      b: PoseKeypoint,
      c: PoseKeypoint,
    ): number => {
      const radians =
        Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs((radians * 180.0) / Math.PI);
      if (angle > 180.0) angle = 360 - angle;
      return angle;
    };

    const segmentAngleFromHorizontal = (
      a: PoseKeypoint,
      b: PoseKeypoint,
    ): number => {
      const angle = Math.abs(
        (Math.atan2(b.y - a.y, b.x - a.x) * 180.0) / Math.PI,
      );
      return angle > 90 ? 180 - angle : angle;
    };

    // Shared "military bearing" checks used by all postures
    if (isVisible(leftShoulder, 0.4) && isVisible(rightShoulder, 0.4)) {
      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      if (shoulderDiff < 0.03) {
        addScore(10, "✓ Shoulders square and level");
      } else if (shoulderDiff < 0.06) {
        addScore(5, "", "Level your shoulders");
      } else {
        recommendations.push("Keep shoulders even and square");
      }
    }

    if (isVisible(leftHip, 0.4) && isVisible(rightHip, 0.4)) {
      const hipDiff = Math.abs(leftHip.y - rightHip.y);
      if (hipDiff < 0.035) {
        addScore(10, "✓ Hips level");
      } else if (hipDiff < 0.06) {
        addScore(5, "", "Level your hips");
      } else {
        recommendations.push("Keep hips level and body erect");
      }
    }

    if (
      isVisible(headPoint, 0.35) &&
      isVisible(leftHip, 0.4) &&
      isVisible(rightHip, 0.4)
    ) {
      const hipCenterX = (leftHip.x + rightHip.x) / 2;
      const torsoAlignment = Math.abs(headPoint.x - hipCenterX);
      if (torsoAlignment < 0.05) {
        addScore(10, "✓ Head and torso aligned");
      } else if (torsoAlignment < 0.09) {
        addScore(5, "", "Keep head and torso vertically aligned");
      } else {
        recommendations.push("Stand straight and keep your head centered");
      }
    }

    if (postureType === "attention") {
      let attentionArmsAtSide: boolean | null = null;
      let attentionRightHandDown: boolean | null = null;
      let attentionArmSignatureReliable = false;
      let attentionFeetGood = false;
      let attentionKneesGood = false;
      let attentionArmsGood = false;
      let attentionHeadGood = false;

      // POSITION OF ATTENTION (100 total)
      // 1) Feet/heels alignment proxy (15)
      if (isVisible(leftAnkle, 0.35) && isVisible(rightAnkle, 0.35)) {
        const ankleDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        if (ankleDistance >= 0.04 && ankleDistance <= 0.11) {
          attentionFeetGood = true;
          addScore(15, "✓ Feet set in attention stance");
        } else if (ankleDistance < 0.04) {
          addScore(8, "", "Open feet slightly to proper attention angle");
        } else {
          addScore(6, "", "Bring heels closer for attention position");
        }
      }

      // 2) Knees straight without stiffness (20)
      if (
        isVisible(leftHip, 0.35) &&
        isVisible(leftKnee, 0.35) &&
        isVisible(leftAnkle, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(rightKnee, 0.35) &&
        isVisible(rightAnkle, 0.35)
      ) {
        const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        const straightLeft = leftKneeAngle > 162;
        const straightRight = rightKneeAngle > 162;
        if (straightLeft && straightRight) {
          attentionKneesGood = true;
          addScore(20, "✓ Knees straight");
        } else if (straightLeft || straightRight) {
          addScore(10, "", "Straighten both knees for position of attention");
        } else {
          recommendations.push("Keep both knees straight without stiffness");
        }
      }

      // 3) Arms down and straight at trouser seams (25)
      if (
        isVisible(leftShoulder, 0.35) &&
        isVisible(leftElbow, 0.35) &&
        isVisible(leftWrist, 0.35) &&
        isVisible(rightShoulder, 0.35) &&
        isVisible(rightElbow, 0.35) &&
        isVisible(rightWrist, 0.35) &&
        isVisible(leftHip, 0.35) &&
        isVisible(rightHip, 0.35)
      ) {
        attentionArmSignatureReliable = true;
        const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        const rightArmAngle = calculateAngle(
          rightShoulder,
          rightElbow,
          rightWrist,
        );
        const armsStraight = leftArmAngle > 155 && rightArmAngle > 155;
        const leftAtSide =
          Math.abs(leftWrist.x - leftHip.x) < 0.13 &&
          leftWrist.y > leftHip.y - 0.02;
        const rightAtSide =
          Math.abs(rightWrist.x - rightHip.x) < 0.13 &&
          rightWrist.y > rightHip.y - 0.02;
        attentionArmsAtSide = leftAtSide && rightAtSide;
        attentionRightHandDown = rightWrist.y >= rightShoulder.y - 0.02;
        if (armsStraight && leftAtSide && rightAtSide) {
          attentionArmsGood = true;
          addScore(25, "✓ Arms straight at sides");
        } else if ((leftAtSide && rightAtSide) || armsStraight) {
          addScore(
            12,
            "",
            "Keep both arms straight with thumbs along trouser seams",
          );
        } else {
          recommendations.push("Arms should hang straight down at your sides");
        }
      }

      // Lightweight right-hand check to catch salute-like pose even when one arm
      // is partially occluded and the full arm signature above cannot run.
      if (attentionRightHandDown === null) {
        if (isVisible(rightWrist, 0.35) && isVisible(rightShoulder, 0.35)) {
          attentionRightHandDown = rightWrist.y >= rightShoulder.y - 0.02;
        }
      }

      // 4) Head erect and eyes front (10)
      if (
        isVisible(headPoint, 0.35) &&
        isVisible(leftShoulder, 0.35) &&
        isVisible(rightShoulder, 0.35)
      ) {
        const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
        const headCentered = Math.abs(headPoint.x - shoulderCenterX) < 0.05;
        if (headCentered) {
          attentionHeadGood = true;
          addScore(10, "✓ Head erect, facing front");
        } else {
          addScore(4, "", "Keep head erect and facing straight front");
        }
      }

      // 5) Visibility bonus (5)
      if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) {
        addScore(5, "✓ Full body clearly visible");
      }

      // Hard gate: if cadet appears to be saluting, attention must fail strongly.
      if (attentionRightHandDown === false) {
        scoreCap = Math.min(scoreCap, 40);
        recommendations.push(
          "For attention, keep right hand down at your side",
        );
      }
      if (attentionArmsAtSide === false) {
        scoreCap = Math.min(scoreCap, 65);
      }
      // Fail-safe: if upper limb signature is not reliable, avoid high "good"
      // labels from partial-keypoint false positives.
      if (!attentionArmSignatureReliable) {
        scoreCap = Math.min(scoreCap, 50);
        recommendations.push(
          "Ensure both arms and hips are fully visible for attention validation",
        );
      }

      perfectCriticalChecksPassed =
        attentionFeetGood &&
        attentionKneesGood &&
        attentionArmsGood &&
        attentionHeadGood &&
        attentionRightHandDown === true &&
        attentionArmsAtSide === true &&
        scoreCap === 100;
    } else if (postureType === "salutation") {
      let saluteHandOnTarget = false;
      let saluteElbowUpperArmCorrect = false;
      let saluteForearm45 = false;
      let looksLikeAttention = false;
      let saluteBaseBearingStrong = false;

      // HAND SALUTE (100 total)
      // 1) Base attention posture while saluting (40)
      if (
        isVisible(leftHip, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(leftShoulder, 0.35) &&
        isVisible(rightShoulder, 0.35)
      ) {
        let base = 0;
        const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        const hipDiff = Math.abs(leftHip.y - rightHip.y);
        if (shoulderDiff < 0.04) base += 12;
        if (hipDiff < 0.04) base += 10;
        if (isVisible(headPoint, 0.35)) {
          const hipCenterX = (leftHip.x + rightHip.x) / 2;
          if (Math.abs(headPoint.x - hipCenterX) < 0.06) base += 10;
        }
        if (
          isVisible(leftWrist, 0.35) &&
          isVisible(leftElbow, 0.35) &&
          isVisible(leftShoulder, 0.35)
        ) {
          const leftArmAngle = calculateAngle(
            leftShoulder,
            leftElbow,
            leftWrist,
          );
          if (leftArmAngle > 155 && leftWrist.y > leftHip.y - 0.02) base += 8;
        }
        score += Math.min(40, base);
        saluteBaseBearingStrong = base >= 30;
        if (base >= 30) {
          feedback.push("✓ Maintains attention posture while saluting");
        } else {
          recommendations.push(
            "Maintain attention posture while rendering salute",
          );
        }
      }

      // 2) Right hand to visor/right eye area (25)
      if (
        isVisible(rightWrist, 0.4) &&
        isVisible(headPoint, 0.35) &&
        isVisible(rightShoulder, 0.4)
      ) {
        const wristNearForehead =
          rightWrist.y <= headPoint.y + 0.02 &&
          rightWrist.y >= headPoint.y - 0.14;
        const wristRaised = rightWrist.y < rightShoulder.y;
        const wristNearRightFace = Math.abs(rightWrist.x - headPoint.x) < 0.18;
        saluteHandOnTarget =
          wristNearForehead && wristRaised && wristNearRightFace;
        if (wristNearForehead && wristRaised && wristNearRightFace) {
          addScore(25, "✓ Right hand at proper salute point");
        } else if (wristRaised) {
          addScore(
            12,
            "",
            "Place right forefinger near visor/right eyebrow level",
          );
        } else {
          recommendations.push("Raise right hand sharply to salute position");
        }
      }

      // 3) Elbow forward / upper arm near horizontal (20)
      if (
        isVisible(rightShoulder, 0.4) &&
        isVisible(rightElbow, 0.4) &&
        isVisible(rightWrist, 0.4)
      ) {
        const upperArmHorizontal =
          Math.abs(rightElbow.y - rightShoulder.y) < 0.07;
        const elbowAwayFromTorso =
          Math.abs(rightElbow.x - rightShoulder.x) > 0.05;
        saluteElbowUpperArmCorrect = upperArmHorizontal && elbowAwayFromTorso;
        if (upperArmHorizontal && elbowAwayFromTorso) {
          addScore(20, "✓ Elbow position and upper arm are correct");
        } else if (upperArmHorizontal || elbowAwayFromTorso) {
          addScore(
            10,
            "",
            "Keep elbow slightly forward and upper arm near horizontal",
          );
        } else {
          recommendations.push(
            "Set elbow slightly forward with upper arm horizontal",
          );
        }
      }

      // 4) Forearm at about 45 degrees (10)
      if (isVisible(rightElbow, 0.4) && isVisible(rightWrist, 0.4)) {
        const forearmAngle = segmentAngleFromHorizontal(rightElbow, rightWrist);
        saluteForearm45 = forearmAngle >= 35 && forearmAngle <= 60;
        if (forearmAngle >= 35 && forearmAngle <= 60) {
          addScore(10, "✓ Forearm angle is near 45 degrees");
        } else if (forearmAngle >= 25 && forearmAngle <= 70) {
          addScore(5, "", "Adjust forearm to approximately 45 degrees");
        } else {
          recommendations.push("Forearm should be inclined around 45 degrees");
        }
      }

      // 5) Visibility bonus (5)
      if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) {
        addScore(5, "✓ Full body clearly visible");
      }

      // Detect likely "attention" being graded as salute.
      if (
        isVisible(leftWrist, 0.35) &&
        isVisible(rightWrist, 0.35) &&
        isVisible(leftHip, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(rightShoulder, 0.35)
      ) {
        const bothAtSides =
          Math.abs(leftWrist.x - leftHip.x) < 0.14 &&
          Math.abs(rightWrist.x - rightHip.x) < 0.14 &&
          leftWrist.y > leftHip.y - 0.02 &&
          rightWrist.y > rightHip.y - 0.02;
        const rightHandNotRaised = rightWrist.y >= rightShoulder.y - 0.02;
        looksLikeAttention = bothAtSides && rightHandNotRaised;
      }

      // Hard gates for salute: without core salute signature, cannot get high score.
      if (!saluteHandOnTarget) {
        scoreCap = Math.min(scoreCap, 45);
        recommendations.push(
          "Salute requires right forefinger near visor/right eye level",
        );
      }
      if (!saluteElbowUpperArmCorrect) {
        scoreCap = Math.min(scoreCap, 55);
      }
      if (!saluteForearm45) {
        scoreCap = Math.min(scoreCap, 70);
      }
      if (looksLikeAttention) {
        scoreCap = Math.min(scoreCap, 35);
        recommendations.push(
          "Detected attention stance; raise right hand to proper salute",
        );
      }

      perfectCriticalChecksPassed =
        saluteBaseBearingStrong &&
        saluteHandOnTarget &&
        saluteElbowUpperArmCorrect &&
        saluteForearm45 &&
        !looksLikeAttention &&
        scoreCap === 100;
    } else if (postureType === "marching") {
      let marchingLegLiftDetected = false;
      let marchingSupportStrong = false;
      let marchingTorsoStrong = false;
      let marchingArmsStrong = false;

      // PROPER MARCHING IN PLACE (100 total, single-frame proxy)
      // 1) One leg raised while other supports (30)
      if (
        isVisible(leftHip, 0.35) &&
        isVisible(leftKnee, 0.35) &&
        isVisible(leftAnkle, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(rightKnee, 0.35) &&
        isVisible(rightAnkle, 0.35)
      ) {
        const leftKneeLift = leftHip.y - leftKnee.y;
        const rightKneeLift = rightHip.y - rightKnee.y;
        const leftRaised = leftKneeLift > 0.06;
        const rightRaised = rightKneeLift > 0.06;
        marchingLegLiftDetected =
          (leftRaised && !rightRaised) || (rightRaised && !leftRaised);
        if ((leftRaised && !rightRaised) || (rightRaised && !leftRaised)) {
          addScore(30, "✓ Correct marching leg lift");
        } else if (leftRaised || rightRaised) {
          addScore(18, "", "Raise one leg clearly while the other supports");
        } else {
          recommendations.push("Lift each leg higher during march in place");
        }
      }

      // 2) Supporting leg straight (20)
      if (
        isVisible(leftHip, 0.35) &&
        isVisible(leftKnee, 0.35) &&
        isVisible(leftAnkle, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(rightKnee, 0.35) &&
        isVisible(rightAnkle, 0.35)
      ) {
        const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
        const oneStraight = leftKneeAngle > 158 || rightKneeAngle > 158;
        const bothStraight = leftKneeAngle > 158 && rightKneeAngle > 158;
        if (bothStraight) {
          marchingSupportStrong = true;
          addScore(20, "✓ Lower body remains disciplined");
        } else if (oneStraight) {
          addScore(12, "", "Keep the supporting leg straighter");
        } else {
          recommendations.push("Avoid bending both knees while marching");
        }
      }

      // 3) Torso erect and head front (20)
      if (
        isVisible(headPoint, 0.35) &&
        isVisible(leftHip, 0.35) &&
        isVisible(rightHip, 0.35) &&
        isVisible(leftShoulder, 0.35) &&
        isVisible(rightShoulder, 0.35)
      ) {
        const hipCenterX = (leftHip.x + rightHip.x) / 2;
        const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
        const torsoAligned = Math.abs(headPoint.x - hipCenterX) < 0.08;
        if (torsoAligned && shoulderDiff < 0.05) {
          marchingTorsoStrong = true;
          addScore(20, "✓ Torso stays upright while marching");
        } else if (torsoAligned || shoulderDiff < 0.05) {
          addScore(10, "", "Keep body erect and eyes front during march");
        } else {
          recommendations.push(
            "Maintain upright military bearing while marching",
          );
        }
      }

      // 4) Arms remain at sides (15)
      if (
        isVisible(leftWrist, 0.35) &&
        isVisible(rightWrist, 0.35) &&
        isVisible(leftHip, 0.35) &&
        isVisible(rightHip, 0.35)
      ) {
        const leftAtSide = Math.abs(leftWrist.x - leftHip.x) < 0.16;
        const rightAtSide = Math.abs(rightWrist.x - rightHip.x) < 0.16;
        if (leftAtSide && rightAtSide) {
          marchingArmsStrong = true;
          addScore(15, "✓ Arms remain at sides");
        } else if (leftAtSide || rightAtSide) {
          addScore(8, "", "Keep both arms at your sides while marching");
        } else {
          recommendations.push("Arms should stay at sides as in attention");
        }
      }

      // 5) Frame quality / readiness (15)
      if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) {
        addScore(15, "✓ Marching posture clearly visible");
      } else if (visibleKeypoints.length >= 10 && avgConfidence > 0.5) {
        addScore(
          8,
          "",
          "Improve framing and lighting for more accurate marching score",
        );
      } else {
        recommendations.push(
          "Ensure full body is visible for marching assessment",
        );
      }

      // Hard gate: marching requires observable leg lift.
      if (!marchingLegLiftDetected) {
        scoreCap = Math.min(scoreCap, 50);
        recommendations.push(
          "Marching in place requires clear alternating leg lift",
        );
      }

      perfectCriticalChecksPassed =
        marchingLegLiftDetected &&
        marchingSupportStrong &&
        marchingTorsoStrong &&
        marchingArmsStrong &&
        scoreCap === 100;
    }

    // [SCORING UPGRADE] Calibrated confidence scaling.
    // Keep strong form from being over-penalized at medium/high confidence.
    let confidenceMultiplier = 1.0;
    if (avgConfidence < 0.45) {
      confidenceMultiplier = Math.max(0.45, avgConfidence / 0.45);
    } else if (avgConfidence < 0.65) {
      confidenceMultiplier = 0.92 + (avgConfidence - 0.45) * 0.35;
    }
    // Above 0.65 confidence: full score (multiplier = 1.0)

    score = Math.round(score * confidenceMultiplier);

    const blended = this.blendWithCosineTemplateScore(
      keypoints,
      postureType,
      score,
      avgConfidence,
    );
    score = blended.score;

    if (blended.cosineScore !== null) {
      if (blended.cosineScore >= 80) {
        feedback.push("✓ Strong template alignment");
      } else if (blended.cosineScore < 60) {
        recommendations.push(
          `Improve ${postureType} shape alignment with the reference template`,
        );
      }
    }

    score = Math.min(score, scoreCap);

    // Cap at 100, but allow low scores
    score = Math.min(100, Math.max(0, score));

    // [SCORING UPGRADE] Preserve analytics score separately from displayed score.
    const rawScore = score;

    // [SCORING UPGRADE] Perfect-grade rule for stable, complete, high-confidence posture.
    const qualifiesForPerfect100 =
      perfectCriticalChecksPassed &&
      visibleKeypoints.length >= 15 &&
      avgConfidence >= 0.8;
    const displayScore = qualifiesForPerfect100 ? 100 : rawScore;

    const success = displayScore >= 75;
    const feedbackMessage =
      feedback.length > 0
        ? feedback.join(", ")
        : `${postureType.toUpperCase()}: ${displayScore}% - ${visibleKeypoints.length}/17 keypoints detected`;

    return {
      success,
      overall_score: displayScore,
      raw_score: rawScore,
      posture_status: this.getPostureStatus(displayScore),
      feedback: feedbackMessage,
      confidence: avgConfidence,
      recommendations:
        recommendations.length > 0
          ? recommendations
          : ["Maintain current posture"],
    };
  }

  /**
   * Get posture status label - Updated thresholds aligned with confidence-based scoring
   */
  private getPostureStatus(score: number): string {
    if (score >= 85) return "Outstanding";
    if (score >= 75) return "Excellent";
    if (score >= 65) return "Good";
    if (score >= 50) return "Fair";
    if (score >= 30) return "Needs Improvement";
    return "Poor Posture";
  }

  /**
   * Get fallback analysis when detection fails - NO FAKE SCORES
   */

  private getFallbackAnalysis(_postureType: string): PostureAnalysis {
    // NO PERSON DETECTED = ZERO SCORE, NO FALLBACK
    return {
      success: false,
      overall_score: 0,
      raw_score: 0,
      posture_status: "No Person Detected",
      feedback: "No person detected in frame",
      confidence: 0,
      keypoints: [],
      recommendations: [
        "Position yourself in front of camera",
        "Ensure full body is visible",
        "Check camera permissions and lighting",
      ],
      timestamp: new Date().toISOString(),
      model_used: "none",
    };
  }

  /**
   * Unload model to free memory
   */
  async unloadModel(): Promise<void> {
    if (this.session) {
      await this.session.release();
      this.session = null;
      this.modelConfig = null;
      console.log("✅ Model unloaded");
    }
  }
}

// Export singleton instance
export const localPoseDetection = new LocalPoseDetectionService();

// Export class for testing
export { LocalPoseDetectionService };
