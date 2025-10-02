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

export const Camera = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [currentPosture, setCurrentPosture] = useState<string>("salutation")
  const [cameraError, setCameraError] = useState<CameraError | null>(null)
  const [cameraLoading, setCameraLoading] = useState<boolean>(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [debugResponse, setDebugResponse] = useState<object | null>(null)
  const [scanCountdown, setScanCountdown] = useState<number | null>(null)

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
    marching: "Marching-Left-Foot,Marching-Right-Foot",
    attention: "Position-of-Attention",
  }

  useEffect(() => {
    startCamera()
    
    // Return cleanup function
    return () => {
      // Access current stream at cleanup time
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        streamRef.current = null
      }
    }
  }, []) // Empty dependency array prevents restart loop

  const startCamera = async (): Promise<void> => {
    // Clean up any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      streamRef.current = null
    }

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
      } catch (err: unknown) {
        const error = err as { name: string }
        if (error.name === "OverconstrainedError" || error.name === "NotReadableError") {
          constraints = { video: true }
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
        } else {
          throw err
        }
      }

      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraLoading(false)
    } catch (err: unknown) {
      const error = err as { name: string; message: string }
      console.error("Error accessing camera:", error)
      setCameraLoading(false)

      if (error.name === "NotAllowedError") {
        setCameraError({
          title: "Camera Permission Denied",
          message: "Please allow camera access and refresh the page to use the posture scanner.",
          action: "Allow Camera Access",
        })
      } else if (error.name === "NotFoundError") {
        setCameraError({
          title: "No Camera Found",
          message: "Please connect a camera device and refresh the page.",
          action: "Check Camera Connection",
        })
      } else if (error.name === "NotSupportedError") {
        setCameraError({
          title: "Camera Not Supported",
          message: "Your browser or device does not support camera access.",
          action: "Try Different Browser",
        })
      } else {
        setCameraError({
          title: "Camera Error",
          message: `Unable to access camera: ${error.message}`,
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
            "class": postureClassMap[currentPosture],
          }
        })
      })

      const result = await response.json()
      setDebugResponse(result)

      // Use the correct path for predictions
      const predictions = result?.outputs?.[0]?.predictions?.predictions || []
      const minConfidence = 0.5
      const validPrediction = predictions.find((p: { confidence: number }) => p.confidence >= minConfidence)

      setScanResult({
        success: Boolean(validPrediction),
        score: validPrediction ? 100 : 0,
        feedback: validPrediction
          ? "Correct posture detected!"
          : "Incorrect posture or no posture detected.",
      })
    } catch {
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
    // Clean up existing stream before retrying
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
      streamRef.current = null
    }
    startCamera()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Military grid background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(5,150,105,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(5,150,105,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-b border-emerald-500/30 p-6 shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-2xl shadow-emerald-500/25">
            <span className="text-white text-xl font-bold">�</span>
          </div>
          <div>
            <h1 className="text-white text-2xl font-black tracking-tight">TACTICAL SCANNER</h1>
            <div className="flex items-center space-x-2 mt-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <p className="text-emerald-300 text-sm font-bold">MILITARY POSTURE ANALYSIS SYSTEM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Posture Type Selector */}
      <div className="relative p-6">
        <div className="mb-4">
          <div className="inline-flex items-center px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
            <span className="text-emerald-300 text-xs font-bold tracking-wider">SELECT PROTOCOL</span>
          </div>
        </div>
        <div className="flex space-x-3 mb-6">
          {Object.keys(postureTypes).map((type: string) => (
            <button
              key={type}
              onClick={() => setCurrentPosture(type)}
              className={`px-6 py-4 rounded-xl text-sm font-bold transition-all duration-300 border ${
                currentPosture === type 
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-2xl shadow-emerald-500/25 border-emerald-400/50 scale-105" 
                  : "bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border-slate-600/50 hover:border-emerald-500/30 backdrop-blur-sm hover:text-emerald-300"
              }`}
            >
              {postureTypes[type].title.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="relative px-6 mb-6">
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">📋</span>
            </div>
            <div>
              <h2 className="text-white font-black text-lg">{postureTypes[currentPosture].title.toUpperCase()}</h2>
              <div className="flex items-center space-x-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-300 text-xs font-bold">ACTIVE PROTOCOL</span>
              </div>
            </div>
          </div>
          <p className="text-slate-300 text-sm mb-4 font-medium">{postureTypes[currentPosture].instructions}</p>
          <div className="text-slate-300 text-sm">
            <p className="font-bold mb-3 text-emerald-300 text-xs tracking-wider">TACTICAL CHECKPOINTS:</p>
            <div className="grid grid-cols-2 gap-3">
              {postureTypes[currentPosture].checkpoints.map((checkpoint: string, index: number) => (
                <div key={index} className="flex items-center text-slate-300">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full mr-3 flex-shrink-0"></div>
                  <span className="text-sm font-medium">{checkpoint}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="relative flex-1 px-6 mb-6 flex flex-col items-center">
        <div
          className="relative bg-white/10 backdrop-blur-lg rounded-3xl overflow-hidden border border-white/20 shadow-2xl"
          style={{
            width: "100%",
            maxWidth: 340,
            aspectRatio: "3 / 4",
            minHeight: 400,
            minWidth: 255,
            margin: "0 auto",
          }}
        >
          {cameraLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900/90 to-blue-900/90 backdrop-blur-lg">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white text-lg font-semibold">Starting camera...</p>
              </div>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900/90 to-blue-900/90 backdrop-blur-lg">
              <div className="text-center p-8 max-w-sm">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-white font-bold text-xl mb-3">{cameraError.title}</h3>
                <p className="text-blue-200 text-sm mb-6">{cameraError.message}</p>
                <button
                  onClick={retryCamera}
                  className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-emerald-400 hover:to-green-500 transition-all duration-300 shadow-lg"
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
                onLoadedMetadata={() => {
                  // Ensure video is playing smoothly
                  if (videoRef.current) {
                    videoRef.current.play().catch(console.error)
                  }
                }}
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
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 backdrop-blur-sm z-40">
              <div className="absolute inset-0">
                <div className="w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 animate-pulse"></div>
                <div className="absolute top-1/2 left-0 w-full h-px bg-emerald-400/50 animate-pulse" style={{ animation: "scan 2s linear infinite" }}></div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-8 border border-emerald-500/50 shadow-2xl">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <div>
                      <span className="text-white font-black text-lg">ANALYZING TACTICAL POSTURE</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-emerald-300 text-sm font-bold">AI SYSTEM ACTIVE</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
                      <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <h3 className={`text-2xl font-black mb-4 ${scanResult.success ? "text-emerald-400" : "text-red-400"}`}>
                    {scanResult.success ? "MISSION SUCCESS!" : "REQUIRES ADJUSTMENT"}
                  </h3>
                  <div className="mb-6">
                    <div className="text-4xl font-black text-white mb-1">{scanResult.score}%</div>
                    <div className="text-sm text-emerald-300 font-bold tracking-wider">TACTICAL SCORE</div>
                  </div>
                  <p className="text-slate-300 text-sm mb-8 font-medium">{scanResult.feedback}</p>
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
                  <div className="text-8xl font-black text-emerald-400 mb-6 animate-pulse">{scanCountdown}</div>
                  <p className="text-slate-300 text-xl font-bold">PREPARE FOR TACTICAL SCAN</p>
                  <div className="flex items-center justify-center space-x-2 mt-3">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-300 text-sm font-bold">SYSTEM ARMED</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scan Button */}
      <div className="relative p-6">
        <button
          onClick={handleScanWithCountdown}
          disabled={
            isScanning ||
            !!scanResult ||
            !!cameraError ||
            cameraLoading ||
            scanCountdown !== null
          }
          className={`w-full py-5 rounded-2xl font-black text-lg transition-all duration-300 shadow-2xl border ${
            isScanning || scanResult || cameraError || cameraLoading || scanCountdown !== null
              ? "bg-slate-800/50 text-slate-500 cursor-not-allowed border-slate-600/50"
              : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 active:scale-95 shadow-emerald-500/25 border-emerald-400/50 hover:shadow-emerald-500/40"
          }`}
        >
          {cameraLoading
            ? "⚡ INITIALIZING SCANNER..."
            : isScanning
              ? "🔍 ANALYZING POSTURE..."
              : scanCountdown !== null
                ? `📡 CAPTURING IN ${scanCountdown}...`
                : cameraError
                  ? "❌ SCANNER OFFLINE"
                  : "🎯 INITIATE TACTICAL SCAN"}
        </button>
      </div>

      {/* Bottom Info */}
      <div className="relative px-6 pb-6">
        <div className="text-center text-emerald-300 text-sm bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-emerald-500/30">
          <p className="font-bold">⚡ OPTIMAL LIGHTING REQUIRED FOR PRECISION ANALYSIS</p>
        </div>
      </div>

      {/* Debug Overlay */}
      {debugResponse && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl border border-emerald-500/30 shadow-2xl max-w-2xl w-full p-6 overflow-auto max-h-[80vh]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">🔍</span>
                </div>
                <span className="font-black text-white text-xl">ROBOFLOW TACTICAL RESPONSE</span>
              </div>
              <button
                className="text-red-400 hover:text-red-300 font-bold px-4 py-2 rounded-xl hover:bg-red-500/20 transition-all duration-300 border border-red-500/30"
                onClick={() => setDebugResponse(null)}
              >
                CLOSE
              </button>
            </div>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap break-all bg-slate-900/50 p-6 rounded-xl border border-emerald-500/20 max-h-96 overflow-auto font-mono">
              {JSON.stringify(debugResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default Camera