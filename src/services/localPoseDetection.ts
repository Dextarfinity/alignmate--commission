/**
 * Local Pose Detection Service
 * Uses ONNX Runtime Web to run YOLOv8 pose models locally
 * Works offline in both web and mobile (Ionic Capacitor)
 */

import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime for web environment
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  name: string;
}

export interface PostureAnalysis {
  success: boolean;
  overall_score: number;
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
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle'
];

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
      name: 'yolov8n-pose',
      path: '/models/yolov8n-pose.onnx',
      inputSize: 640,
      confidence_threshold: 0.45
    },
    {
      name: 'yolov8s-pose',
      path: '/models/yolov8s-pose.onnx',
      inputSize: 640,
      confidence_threshold: 0.50
    }
  ];

  /**
   * Load ONNX model (with fallback support)
   */
  async loadModel(preferredModel: 'nano' | 'small' = 'nano'): Promise<void> {
    if (this.session) {
      console.log('✅ Model already loaded:', this.modelConfig?.name);
      return;
    }

    if (this.isLoading) {
      console.log('⏳ Model loading in progress...');
      return;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      // Select model based on preference
      const modelIndex = preferredModel === 'nano' ? 0 : 1;
      let config = this.availableModels[modelIndex];

      console.log(`🔄 Loading local pose model: ${config.name}...`);

      // Try to load the preferred model
      try {
        const session = await ort.InferenceSession.create(config.path, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });

        this.session = session;
        this.modelConfig = config;
        
        console.log(`✅ Model loaded successfully: ${config.name}`);
        console.log(`📊 Model info:`, {
          inputNames: session.inputNames,
          outputNames: session.outputNames,
          inputSize: config.inputSize
        });

      } catch (error) {
        console.warn(`⚠️ Failed to load ${config.name}, trying fallback...`);
        
        // Try the other model as fallback
        const fallbackIndex = modelIndex === 0 ? 1 : 0;
        config = this.availableModels[fallbackIndex];
        
        const session = await ort.InferenceSession.create(config.path, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all'
        });

        this.session = session;
        this.modelConfig = config;
        
        console.log(`✅ Fallback model loaded: ${config.name}`);
      }

    } catch (error) {
      this.loadError = error as Error;
      console.error('❌ Failed to load any pose model:', error);
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
  getModelStatus(): { loaded: boolean; loading: boolean; error: string | null; model: string | null } {
    return {
      loaded: this.session !== null,
      loading: this.isLoading,
      error: this.loadError?.message || null,
      model: this.modelConfig?.name || null
    };
  }

  /**
   * Preprocess image for YOLO model
   */
  private preprocessImage(imageData: ImageData, inputSize: number): Float32Array {
    const { width, height } = imageData;
    
    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(inputSize / width, inputSize / height);
    const newWidth = Math.round(width * scale);
    const newHeight = Math.round(height * scale);
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = inputSize;
    canvas.height = inputSize;
    const ctx = canvas.getContext('2d')!;
    
    // Fill with gray background
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, inputSize, inputSize);
    
    // Calculate offset to center the image
    const offsetX = (inputSize - newWidth) / 2;
    const offsetY = (inputSize - newHeight) / 2;
    
    // Create temporary canvas with original image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
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
      float32Data[y * inputSize + x] = resizedData.data[i] / 255.0;     // R
      float32Data[inputSize * inputSize + y * inputSize + x] = resizedData.data[i + 1] / 255.0;  // G
      float32Data[2 * inputSize * inputSize + y * inputSize + x] = resizedData.data[i + 2] / 255.0;  // B
    }
    
    return float32Data;
  }

  /**
   * Run pose detection on image
   */
  async detectPose(imageData: ImageData): Promise<PoseKeypoint[]> {
    if (!this.session || !this.modelConfig) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const { inputSize, confidence_threshold } = this.modelConfig;

    // Preprocess image
    const inputTensor = this.preprocessImage(imageData, inputSize);

    // Create input tensor
    const tensor = new ort.Tensor('float32', inputTensor, [1, 3, inputSize, inputSize]);

    // Run inference
    const feeds: Record<string, ort.Tensor> = {};
    feeds[this.session.inputNames[0]] = tensor;

    const results = await this.session.run(feeds);
    const output = results[this.session.outputNames[0]];

    // Parse YOLO pose output
    // Output shape: [batch, 56, 8400] 
    // 56 = 4 (bbox: x, y, w, h) + 1 (confidence) + 51 (17 keypoints * 3: x, y, conf)
    const outputData = output.data as Float32Array;
    const numBoxes = output.dims[2] || 8400;
    const numChannels = output.dims[1] || 56;

    console.log('YOLO Output shape:', output.dims, 'numBoxes:', numBoxes);

    // Find box with highest confidence
    let maxConf = 0;
    let bestBoxIndex = -1;

    for (let i = 0; i < numBoxes; i++) {
      const conf = outputData[4 * numBoxes + i]; // objectness confidence at index 4
      if (conf > maxConf && conf > confidence_threshold) {
        maxConf = conf;
        bestBoxIndex = i;
      }
    }

    console.log('Best box index:', bestBoxIndex, 'confidence:', maxConf);

    // Extract keypoints from best detection
    const keypoints: PoseKeypoint[] = [];
    
    if (bestBoxIndex >= 0) {
      // Keypoints start at channel 5 (after 4 bbox values and 1 conf value)
      // Format: [x0, y0, conf0, x1, y1, conf1, ..., x16, y16, conf16]
      for (let k = 0; k < 17; k++) {
        const xIdx = (5 + k * 3) * numBoxes + bestBoxIndex;     // x coordinate
        const yIdx = (5 + k * 3 + 1) * numBoxes + bestBoxIndex; // y coordinate  
        const cIdx = (5 + k * 3 + 2) * numBoxes + bestBoxIndex; // confidence
        
        const x = outputData[xIdx];
        const y = outputData[yIdx];
        const conf = outputData[cIdx];
        
        console.log(`Keypoint ${k}: x=${x}, y=${y}, conf=${conf}`);
        
        keypoints.push({
          x: x / inputSize, // Normalize to [0, 1]
          y: y / inputSize,
          confidence: conf,
          name: KEYPOINT_NAMES[k]
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
    postureType: 'salutation' | 'marching' | 'attention' = 'salutation'
  ): Promise<PostureAnalysis> {
    try {
      // Ensure model is loaded
      if (!this.session) {
        await this.loadModel('nano'); // Use fastest model by default
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
        model_used: this.modelConfig?.name || 'unknown'
      };

    } catch (error) {
      console.error('Error in analyzePosture:', error);
      
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
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };
      img.onerror = reject;
      img.src = base64;
    });
  }

  /**
   * Analyze pose keypoints for specific posture type - COMPREHENSIVE ANALYSIS
   */
  private analyzePoseKeypoints(
    keypoints: PoseKeypoint[],
    postureType: 'salutation' | 'marching' | 'attention'
  ): Omit<PostureAnalysis, 'keypoints' | 'timestamp' | 'model_used'> {
    
    if (keypoints.length === 0) {
      return this.getFallbackAnalysis(postureType);
    }

    // Calculate average confidence of visible keypoints
    const visibleKeypoints = keypoints.filter(kp => kp.confidence > 0.3);
    const avgConfidence = visibleKeypoints.length > 0
      ? visibleKeypoints.reduce((sum, kp) => sum + kp.confidence, 0) / visibleKeypoints.length
      : 0;

    // If no visible keypoints or very low confidence, return zero score
    if (visibleKeypoints.length < 5 || avgConfidence < 0.3) {
      return this.getFallbackAnalysis(postureType);
    }

    // Extract all keypoints
    const nose = keypoints.find(kp => kp.name === 'nose');
    // const leftEye = keypoints.find(kp => kp.name === 'left_eye');
    // const rightEye = keypoints.find(kp => kp.name === 'right_eye');
    // const leftEar = keypoints.find(kp => kp.name === 'left_ear');
    // const rightEar = keypoints.find(kp => kp.name === 'right_ear');
    const leftShoulder = keypoints.find(kp => kp.name === 'left_shoulder');
    const rightShoulder = keypoints.find(kp => kp.name === 'right_shoulder');
    const leftElbow = keypoints.find(kp => kp.name === 'left_elbow');
    const rightElbow = keypoints.find(kp => kp.name === 'right_elbow');
    const leftWrist = keypoints.find(kp => kp.name === 'left_wrist');
    const rightWrist = keypoints.find(kp => kp.name === 'right_wrist');
    const leftHip = keypoints.find(kp => kp.name === 'left_hip');
    const rightHip = keypoints.find(kp => kp.name === 'right_hip');
    const leftKnee = keypoints.find(kp => kp.name === 'left_knee');
    const rightKnee = keypoints.find(kp => kp.name === 'right_knee');
    const leftAnkle = keypoints.find(kp => kp.name === 'left_ankle');
    const rightAnkle = keypoints.find(kp => kp.name === 'right_ankle');

    let score = 0; // Start from zero - earn points based on posture quality
    const feedback: string[] = [];
    const recommendations: string[] = [];

    // Helper function to calculate angle
    const calculateAngle = (a: PoseKeypoint, b: PoseKeypoint, c: PoseKeypoint): number => {
      const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs(radians * 180.0 / Math.PI);
      if (angle > 180.0) angle = 360 - angle;
      return angle;
    };

    // 1. HEAD ALIGNMENT (10 points)
    if (nose && leftShoulder && rightShoulder && 
        nose.confidence > 0.4 && leftShoulder.confidence > 0.4 && rightShoulder.confidence > 0.4) {
      const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
      const headAlignment = Math.abs(nose.x - shoulderCenterX);
      
      if (headAlignment < 0.05) {
        score += 10;
        feedback.push('✓ Head centered');
      } else if (headAlignment < 0.10) {
        score += 5;
        recommendations.push('Center your head over shoulders');
      } else {
        recommendations.push('Straighten your head position');
      }
    }

    // 2. SHOULDER LEVEL (10 points)
    if (leftShoulder && rightShoulder && 
        leftShoulder.confidence > 0.4 && rightShoulder.confidence > 0.4) {
      const shoulderDiff = Math.abs(leftShoulder.y - rightShoulder.y);
      if (shoulderDiff < 0.03) {
        score += 10;
        feedback.push('✓ Shoulders level');
      } else if (shoulderDiff < 0.06) {
        score += 5;
        recommendations.push('Level your shoulders');
      } else {
        recommendations.push('Keep shoulders even');
      }
    }

    // 3. SPINE ALIGNMENT (15 points)
    if (nose && leftHip && rightHip && 
        nose.confidence > 0.4 && leftHip.confidence > 0.4 && rightHip.confidence > 0.4) {
      const hipCenterX = (leftHip.x + rightHip.x) / 2;
      const alignment = Math.abs(nose.x - hipCenterX);
      
      if (alignment < 0.06) {
        score += 15;
        feedback.push('✓ Excellent spine alignment');
      } else if (alignment < 0.12) {
        score += 8;
        recommendations.push('Improve vertical alignment');
      } else {
        recommendations.push('Stand up straight');
      }
    }

    // 4. HIP LEVEL (5 points)
    if (leftHip && rightHip && 
        leftHip.confidence > 0.4 && rightHip.confidence > 0.4) {
      const hipDiff = Math.abs(leftHip.y - rightHip.y);
      if (hipDiff < 0.04) {
        score += 5;
        feedback.push('✓ Hips level');
      }
    }

    // 5. LEG POSTURE (10 points)
    if (leftKnee && rightKnee && leftAnkle && rightAnkle &&
        leftKnee.confidence > 0.3 && rightKnee.confidence > 0.3) {
      
      // Check if legs are straight
      const leftLegAlignment = leftKnee.x - (leftAnkle?.x || leftKnee.x);
      const rightLegAlignment = rightKnee.x - (rightAnkle?.x || rightKnee.x);
      
      if (Math.abs(leftLegAlignment) < 0.08 && Math.abs(rightLegAlignment) < 0.08) {
        score += 10;
        feedback.push('✓ Legs straight');
      } else {
        score += 5;
        recommendations.push('Keep legs straight');
      }
    }

    // POSTURE-SPECIFIC CHECKS
    if (postureType === 'salutation') {
      // SALUTATION: Right hand to forehead, left arm at side
      
      // Right arm raised (20 points)
      if (rightWrist && rightElbow && rightShoulder && nose &&
          rightWrist.confidence > 0.4 && rightElbow.confidence > 0.4) {
        
        // Check if hand is at forehead level
        const handAtHead = rightWrist.y < nose.y;
        const handRaised = rightWrist.y < rightShoulder.y;
        
        if (handAtHead && handRaised) {
          score += 20;
          feedback.push('✓ Perfect salute hand position');
          
          // Check arm angle (should be ~45-90 degrees)
          const armAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
          if (armAngle > 30 && armAngle < 120) {
            score += 5;
            feedback.push('✓ Correct arm angle');
          }
        } else if (handRaised) {
          score += 10;
          recommendations.push('Raise hand to forehead level');
        } else {
          score += 5;
          recommendations.push('Raise right hand for salute');
        }
      }
      
      // Left arm at side (5 points)
      if (leftWrist && leftHip && leftWrist.confidence > 0.3) {
        if (leftWrist.y > (leftHip?.y || 0.6)) {
          score += 5;
          feedback.push('✓ Left arm at side');
        }
      }
      
    } else if (postureType === 'attention') {
      // ATTENTION: Both arms straight at sides, rigid posture
      
      // Arms at sides (15 points)
      if (leftWrist && rightWrist && leftHip && rightHip &&
          leftWrist.confidence > 0.3 && rightWrist.confidence > 0.3) {
        const leftArmAtSide = leftWrist.y > (leftHip?.y || 0.6) && 
                              Math.abs(leftWrist.x - (leftHip?.x || 0)) < 0.15;
        const rightArmAtSide = rightWrist.y > (rightHip?.y || 0.6) && 
                               Math.abs(rightWrist.x - (rightHip?.x || 0)) < 0.15;
        
        if (leftArmAtSide && rightArmAtSide) {
          score += 15;
          feedback.push('✓ Arms properly at sides');
        } else {
          score += 7;
          recommendations.push('Keep arms straight at sides');
        }
      }
      
      // Straight arms check (5 points)
      if (leftElbow && leftWrist && leftShoulder &&
          leftElbow.confidence > 0.3 && leftWrist.confidence > 0.3) {
        const leftArmAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
        if (leftArmAngle > 160) {
          score += 5;
          feedback.push('✓ Arms straight');
        }
      }
      
    } else if (postureType === 'marching') {
      // MARCHING: Ready stance, balanced posture
      
      // Balanced stance (10 points)
      if (leftAnkle && rightAnkle && 
          leftAnkle.confidence > 0.3 && rightAnkle.confidence > 0.3) {
        const feetDistance = Math.abs(leftAnkle.x - rightAnkle.x);
        
        if (feetDistance > 0.1 && feetDistance < 0.25) {
          score += 10;
          feedback.push('✓ Good stance width');
        } else if (feetDistance < 0.1) {
          recommendations.push('Widen your stance slightly');
        } else {
          recommendations.push('Narrow your stance');
        }
      }
      
      // Arms ready position (10 points)
      if (leftElbow && rightElbow && 
          leftElbow.confidence > 0.3 && rightElbow.confidence > 0.3) {
        const elbowsVisible = true;
        if (elbowsVisible) {
          score += 10;
          feedback.push('✓ Arms in ready position');
        }
      }
    }

    // Bonus for excellent keypoint detection (5 points)
    if (visibleKeypoints.length >= 14 && avgConfidence > 0.7) {
      score += 5;
      feedback.push('✓ Full body visible');
    }

    // Apply confidence-based scaling to final score
    // Lower confidence = lower maximum possible score
    let confidenceMultiplier = 1.0;
    if (avgConfidence < 0.5) {
      confidenceMultiplier = avgConfidence / 0.5; // Scale down significantly if confidence < 50%
    } else if (avgConfidence < 0.7) {
      confidenceMultiplier = 0.85 + (avgConfidence - 0.5) * 0.75; // Gradual scale between 50-70%
    }
    // Above 0.7 confidence: full score (multiplier = 1.0)

    score = Math.round(score * confidenceMultiplier);

    // Cap at 100, but allow low scores
    score = Math.min(100, Math.max(0, score));

    const success = score >= 75;
    const feedbackMessage = feedback.length > 0 
      ? feedback.join(', ')
      : `${postureType.toUpperCase()}: ${score}% - ${visibleKeypoints.length}/17 keypoints detected`;

    return {
      success,
      overall_score: score,
      posture_status: this.getPostureStatus(score),
      feedback: feedbackMessage,
      confidence: avgConfidence,
      recommendations: recommendations.length > 0 ? recommendations : ['Maintain current posture']
    };
  }

  /**
   * Get posture status label - Updated thresholds aligned with confidence-based scoring
   */
  private getPostureStatus(score: number): string {
    if (score >= 85) return 'Outstanding';
    if (score >= 75) return 'Excellent';
    if (score >= 65) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Needs Improvement';
    return 'Poor Posture';
  }

  /**
   * Get fallback analysis when detection fails - NO FAKE SCORES
   */
  private getFallbackAnalysis(_postureType: string): PostureAnalysis {
    // NO PERSON DETECTED = ZERO SCORE, NO FALLBACK
    return {
      success: false,
      overall_score: 0,
      posture_status: 'No Person Detected',
      feedback: 'No person detected in frame',
      confidence: 0,
      keypoints: [],
      recommendations: [
        'Position yourself in front of camera',
        'Ensure full body is visible',
        'Check camera permissions and lighting'
      ],
      timestamp: new Date().toISOString(),
      model_used: 'none'
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
      console.log('✅ Model unloaded');
    }
  }
}

// Export singleton instance
export const localPoseDetection = new LocalPoseDetectionService();

// Export class for testing
export { LocalPoseDetectionService };
