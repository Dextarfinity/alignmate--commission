"use client"
import { useState, useRef, useEffect } from "react"

interface PostureType {
  title: string
  instructions: string
  checkpoints: string[]
}

interface ScanResult {
  success: boolean
  score: number
  feedback: string
}

interface CameraError {
  title: string
  message: string
  action: string
}

interface PostureTypes {
  [key: string]: PostureType
}

export const Home = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [currentPosture, setCurrentPosture] = useState<string>("salutation")
  const [cameraError, setCameraError] = useState<CameraError | null>(null)
  const [cameraLoading, setCameraLoading] = useState<boolean>(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [debugResponse, setDebugResponse] = useState<any>(null); // <-- Add this
  const [scanCountdown, setScanCountdown] = useState<number | null>(null) // <-- Add this

  const postureTypes: PostureTypes = {
    salutation: {
      title: "Proper Salutation",
      instructions: "Stand at attention, raise right hand to forehead",
      checkpoints: ["Straight posture", "Right hand to forehead", "Eyes forward", "Feet together"],
    },
    marching: {
      title: "Marching Position",
      instructions: "Stand ready for marching command",
      checkpoints: ["Upright posture", "Arms at sides", "Weight balanced", "Ready stance"],
    },
    attention: {
      title: "At Attention",
      instructions: "Stand perfectly straight with arms at sides",
      checkpoints: ["Straight spine", "Arms at sides", "Heels together", "Eyes forward"],
    },
  }

  const postureClassMap: Record<string, string> = {
    salutation: "Proper-Salutation",
    marching: "Marching-Left-Foot,Marching-Right-Foot", // If you want both, comma-separated or as an array if supported
    attention: "Position-of-Attention",
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      }
    }
  }, [])

  const startCamera = async (): Promise<void> => {
    setCameraLoading(true)
    setCameraError(null)

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported by this browser")
      }

      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      }

      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err: any) {
        if (err.name === "OverconstrainedError" || err.name === "NotReadableError") {
          constraints = { video: true }
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        } else {
          throw err
        }
      }

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraLoading(false)
    } catch (err: any) {
      console.error("Error accessing camera:", err)
      setCameraLoading(false)

      if (err.name === "NotAllowedError") {
        setCameraError({
          title: "Camera Permission Denied",
          message: "Please allow camera access and refresh the page to use the posture scanner.",
          action: "Allow Camera Access",
        })
      } else if (err.name === "NotFoundError") {
        setCameraError({
          title: "No Camera Found",
          message: "Please connect a camera device and refresh the page.",
          action: "Check Camera Connection",
        })
      } else if (err.name === "NotSupportedError") {
        setCameraError({
          title: "Camera Not Supported",
          message: "Your browser or device does not support camera access.",
          action: "Try Different Browser",
        })
      } else {
        setCameraError({
          title: "Camera Error",
          message: `Unable to access camera: ${err.message}`,
          action: "Retry Camera Access",
        })
      }
    }
  }

  const handleScan = async (): Promise<void> => {
    setIsScanning(true)
    setScanResult(null)
    setDebugResponse(null)

    if (!videoRef.current) {
      setScanResult({
        success: false,
        score: 0,
        feedback: "Camera not available",
      })
      setIsScanning(false)
      return
    }

    // Capture frame from video
    const video = videoRef.current
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      setScanResult({
        success: false,
        score: 0,
        feedback: "Unable to capture image",
      })
      setIsScanning(false)
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to base64 data URL
    const dataUrl = canvas.toDataURL("image/png")

    try {
      const response = await fetch('https://serverless.roboflow.com/infer/workflows/dextarfinity/csu-proper-formation-rotc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: 'Gj0UpEAl2hTY8liTewsX',
          inputs: {
            "image": { "type": "base64", "value": dataUrl },
            "class": postureClassMap[currentPosture], // <-- Add this line
          }
        })
      })

      const result = await response.json()
      setDebugResponse(result)

      // FIX: Use the correct path for predictions
      const predictions = result?.outputs?.[0]?.predictions?.predictions || []
      const minConfidence = 0.5
      const validPrediction = predictions.find((p: any) => p.confidence >= minConfidence)

      setScanResult({
        success: !!validPrediction,
        score: !!validPrediction ? 100 : 0,
        feedback: !!validPrediction
          ? "Correct posture detected!"
          : "Incorrect posture or no posture detected.",
      })
    } catch (error) {
      setScanResult({
        success: false,
        score: 0,
        feedback: "Error connecting to Roboflow server",
      })
    }
    setIsScanning(false)
  }

  const handleScanWithCountdown = () => {
    setScanCountdown(5)
    setScanResult(null)
    setDebugResponse(null)
    let count = 5
    const interval = setInterval(() => {
      count -= 1
      setScanCountdown(count)
      if (count === 0) {
        clearInterval(interval)
        setScanCountdown(null)
        handleScan()
      }
    }, 1000)
  }

  const resetScan = (): void => {
    setScanResult(null)
    setIsScanning(false)
  }

  const retryCamera = (): void => {
    startCamera()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-600 to-green-800 flex flex-col">
      {/* Header */}
      <div className="bg-green-700 p-4 text-center">
        <h1 className="text-white text-xl font-bold">Military Posture Scanner</h1>
        <p className="text-green-100 text-sm mt-1">Ensure proper military bearing</p>
      </div>

      {/* Posture Type Selector */}
      <div className="p-4">
        <div className="flex space-x-2 mb-4">
          {Object.keys(postureTypes).map((type: string) => (
            <button
              key={type}
              onClick={() => setCurrentPosture(type)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPosture === type ? "bg-white text-green-700" : "bg-green-600 text-white hover:bg-green-500"
              }`}
            >
              {postureTypes[type].title}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="px-4 mb-4">
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <h2 className="text-white font-semibold mb-2">{postureTypes[currentPosture].title}</h2>
          <p className="text-gray-100 text-sm mb-3">{postureTypes[currentPosture].instructions}</p>
          <div className="text-gray-100 text-xs">
            <p className="font-medium mb-1 text-white">Checkpoints:</p>
            <ul className="space-y-1">
              {postureTypes[currentPosture].checkpoints.map((checkpoint: string, index: number) => (
                <li key={index} className="flex items-center text-gray-100">
                  <div className="w-1.5 h-1.5 bg-green-300 rounded-full mr-2"></div>
                  {checkpoint}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 px-4 mb-4 flex flex-col items-center">
        <div
          className="relative bg-black rounded-2xl overflow-hidden"
          style={{
            width: "100%",
            maxWidth: 340, // e.g., 3:4 ratio, 340x453
            aspectRatio: "3 / 4",
            minHeight: 400,
            minWidth: 255,
            margin: "0 auto",
          }}
        >
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-3"></div>
                <p className="text-white text-sm">Starting camera...</p>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center p-6 max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{cameraError.title}</h3>
                <p className="text-gray-300 text-sm mb-4">{cameraError.message}</p>
                <button
                  onClick={retryCamera}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  {cameraError.action}
                </button>
              </div>
            </div>
          )}

          {!cameraLoading && !cameraError && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ aspectRatio: "3 / 4" }}
              />

              {/* Overlay Frame */}
              <div className="absolute inset-2 border-2 border-white/50 rounded-xl pointer-events-none" style={{ aspectRatio: "3 / 4" }}>
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white"></div>
              </div>

              {/* Center Guidelines */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-px h-2/3 bg-white/30"></div>
                <div className="absolute w-2/3 h-px bg-white/30"></div>
              </div>

              {/* Instruction Overlay */}
              <div className="absolute top-4 left-4 right-4">
                <div className="bg-black/50 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-white text-sm text-center">Make sure your full body is in the frame</p>
                </div>
              </div>
            </>
          )}

          {/* Scanning Animation */}
          {isScanning && (
            <div className="absolute inset-0 bg-green-500/20">
              <div className="absolute inset-0 animate-pulse">
                <div className="w-full h-1 bg-green-400 animate-bounce"></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/70 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span className="text-white font-medium">Analyzing posture...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Result Overlay */}
          {scanResult && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="bg-white rounded-lg p-6 mx-4 max-w-sm w-full">
                <div className="text-center">
                  <div
                    className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                      scanResult.success ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {scanResult.success ? (
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <h3 className={`text-lg font-bold mb-2 ${scanResult.success ? "text-green-700" : "text-red-700"}`}>
                    {scanResult.success ? "Well Done!" : "Needs Improvement"}
                  </h3>
                  <div className="mb-3">
                    <div className="text-2xl font-bold text-gray-800">{scanResult.score}%</div>
                    <div className="text-sm text-gray-600">Posture Score</div>
                  </div>
                  <p className="text-gray-700 text-sm mb-4">{scanResult.feedback}</p>
                  <button
                    onClick={resetScan}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    Scan Again
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan Button */}
      <div className="p-4">
        <button
          onClick={handleScanWithCountdown}
          disabled={
            isScanning ||
            !!scanResult ||
            !!cameraError ||
            cameraLoading ||
            scanCountdown !== null
          }
          className={`w-full py-4 rounded-full font-bold text-lg transition-all ${
            isScanning || scanResult || cameraError || cameraLoading || scanCountdown !== null
              ? "bg-gray-400 text-gray-600 cursor-not-allowed"
              : "bg-white text-green-700 hover:bg-green-50 active:scale-95"
          }`}
        >
          {cameraLoading
            ? "Starting Camera..."
            : isScanning
              ? "Scanning..."
              : scanCountdown !== null
                ? `Capturing in ${scanCountdown}...`
                : cameraError
                  ? "Camera Unavailable"
                  : "Start Posture Scan"}
        </button>
      </div>

      {/* Bottom Info */}
      <div className="p-4 pt-0">
        <div className="text-center text-green-200 text-xs">
          <p>Position yourself in good lighting for best results</p>
        </div>
      </div>

      {/* Debug Overlay */}
      {debugResponse && (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-4 overflow-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-green-700">Roboflow Raw Response</span>
              <button
                className="text-red-600 font-bold px-2 py-1 rounded hover:bg-red-100"
                onClick={() => setDebugResponse(null)}
              >
                Close
              </button>
            </div>
            <pre className="text-xs text-gray-800 whitespace-pre-wrap break-all">
              {JSON.stringify(debugResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
export default Home