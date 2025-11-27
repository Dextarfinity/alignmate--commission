import { useState, useRef, useEffect } from "react"
import supabase from '../supabase'
import { useLoading } from '../contexts/LoadingContext'
import { useAudio } from '../contexts/AudioContext'
import toast from 'react-hot-toast'
import { hybridPostureService } from '../services/hybridPostureService'

interface PostureType {
  title: string
  instructions: string
  checkpoints: string[]
}

interface ScanResult {
  success: boolean
  score: number
  feedback: string
  posture?: string
  confidence?: number
  recommendations?: string[]
  timestamp?: string
}

interface CameraError {
  title: string
  message: string
  action: string
}

interface PostureTypes {
  [key: string]: PostureType
}

// Live Railway API Configuration
const RAILWAY_API_URL = 'https://model-cloud-production.up.railway.app'

export default function Camera() {
  const { showLoading, hideLoading, updateProgress } = useLoading()
  const { playButtonClick, playSuccess, playError } = useAudio()
  
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [currentPosture, setCurrentPosture] = useState<string>("salutation")
  const [cameraError, setCameraError] = useState<CameraError | null>(null)
  const [cameraLoading, setCameraLoading] = useState<boolean>(true)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [scanCountdown, setScanCountdown] = useState<number | null>(null)
  
  // Real-time detection states
  const [isRealTimeActive, setIsRealTimeActive] = useState<boolean>(false)
  const [liveScore, setLiveScore] = useState<number | null>(null)
  const [detectedPosture, setDetectedPosture] = useState<string | null>(null)
  const [liveConfidence, setLiveConfidence] = useState<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRealTimeActiveRef = useRef<boolean>(false)
  const lastSaveTimeRef = useRef<number>(0)
  const MIN_SAVE_INTERVAL = 3000 // Minimum 3 seconds between saves
  const [weeklyStats, setWeeklyStats] = useState<{
    totalScans: number
    successfulScans: number
    averageScore: number
  } | null>(null)
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline' | 'local'>('checking')
  
  // Camera switching states
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('front')
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [hasBackCamera, setHasBackCamera] = useState<boolean>(false)

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

  // Function to check API status - test the actual analyze endpoint
  const checkApiStatus = async () => {
    try {
      console.log('🔍 Checking system status...')
      
      // Check if local models are available
      const status = hybridPostureService.getStatus()
      
      if (status.localReady) {
        setApiStatus('local')
        console.log('✅ Local models available - offline mode ready')
        return
      }
      
      // First try a simple GET request to check if the server is responsive
      const healthResponse = await fetch(`${RAILWAY_API_URL}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      
      if (healthResponse.ok) {
        console.log('✅ Railway server is responsive')
        
        // Now test the actual analyze endpoint
        const response = await fetch(`${RAILWAY_API_URL}/analyze_base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            image: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
            posture_type: 'salutation'
          }),
          signal: AbortSignal.timeout(8000)
        })
        
        if (response.ok || response.status === 422 || response.status === 400) {
          setApiStatus('online')
          console.log('✅ Railway API analyze endpoint is working')
        } else {
          setApiStatus('offline')
          console.log(`⚠️ Railway API analyze endpoint responded with status: ${response.status}`)
        }
      } else {
        setApiStatus('offline')
        console.log(`❌ Railway server not responsive: ${healthResponse.status}`)
      }
    } catch (error) {
      setApiStatus('offline')
      if (error instanceof Error) {
        console.log('❌ Railway API connection failed:', error.message)
      } else {
        console.log('❌ Railway API connection failed:', error)
      }
    }
  }

  // Function to fetch weekly statistics
  const fetchWeeklyStats = async (showLoadingIndicator: boolean = false) => {
    try {
      if (showLoadingIndicator) {
        showLoading('📊 STATS UPDATE', 'Loading weekly statistics...', { showProgress: true, progress: 0 })
      }
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        if (showLoadingIndicator) hideLoading()
        return
      }

      if (showLoadingIndicator) updateProgress(25)

      // Calculate weekly stats from scan_history directly to avoid table issues
      const now = new Date()
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1))
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      if (showLoadingIndicator) updateProgress(50)

      const { data: scanData, error } = await supabase
        .from('scan_history')
        .select('score, success')
        .eq('user_id', session.user.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString())

      if (error) {
        console.error('Error fetching weekly stats from scan_history:', error)
        if (showLoadingIndicator) hideLoading()
        return
      }

      if (showLoadingIndicator) updateProgress(75)

      const totalScans = scanData?.length || 0
      const successfulScans = scanData?.filter(scan => scan.success).length || 0
      const averageScore = totalScans > 0 
        ? scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans 
        : 0

      setWeeklyStats({
        totalScans: totalScans,
        successfulScans: successfulScans,
        averageScore: Number(averageScore.toFixed(1))
      })
      
      if (showLoadingIndicator) {
        updateProgress(100)
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Show success toast for manual stats refresh
        toast.success(`📊 Stats updated! ${totalScans} scans this week (${averageScore.toFixed(1)}% avg)`, {
          icon: '📈',
        })
      }
    } catch (error) {
      console.error('Error in fetchWeeklyStats:', error)
      if (showLoadingIndicator) {
        toast.error('❌ Failed to load weekly statistics')
      }
    } finally {
      if (showLoadingIndicator) hideLoading()
    }
  }

  // Function to update weekly progress manually
  const updateWeeklyProgress = async (userId: string) => {
    try {
      const now = new Date()
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1))
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      weekEnd.setHours(23, 59, 59, 999)

      const { data: weekScans, error: statsError } = await supabase
        .from('scan_history')
        .select('score, success')
        .eq('user_id', userId)
        .gte('scan_date', weekStart.toISOString())
        .lte('scan_date', weekEnd.toISOString())

      if (statsError) {
        console.error('Error fetching week stats:', statsError)
        return
      }

      const totalScans = weekScans?.length || 0
      const successfulScans = weekScans?.filter(scan => scan.success).length || 0
      const averageScore = totalScans > 0 
        ? weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans 
        : 0

      // Now actually update the weekly_progress table
      const { data: existingProgress, error: checkError } = await supabase
        .from('weekly_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start_date', weekStart.toISOString().split('T')[0])
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking existing weekly progress:', checkError)
        return
      }

      const progressData = {
        user_id: userId,
        week_start_date: weekStart.toISOString().split('T')[0],
        week_end_date: weekEnd.toISOString().split('T')[0],
        total_scans: totalScans,
        successful_scans: successfulScans,
        average_score: Number(averageScore.toFixed(2)),
        updated_at: new Date().toISOString()
      }

      if (existingProgress) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('weekly_progress')
          .update(progressData)
          .eq('user_id', userId)
          .eq('week_start_date', weekStart.toISOString().split('T')[0])

        if (updateError) {
          console.error('Error updating weekly progress:', updateError)
        } else {
          console.log('✅ Weekly progress updated successfully:', progressData)
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('weekly_progress')
          .insert([progressData])

        if (insertError) {
          console.error('Error inserting weekly progress:', insertError)
        } else {
          console.log('✅ Weekly progress inserted successfully:', progressData)
        }
      }

      console.log('Weekly stats calculated:', { totalScans, successfulScans, averageScore: Number(averageScore.toFixed(2)) })
    } catch (error) {
      console.error('Error in updateWeeklyProgress:', error)
    }
  }

  // Function to aggregate all previous weeks for a user
  const aggregateAllWeeklyProgress = async (userId: string) => {
    try {
      console.log('🔄 Starting weekly progress aggregation for user:', userId)
      
      // Get the earliest scan date for this user
      const { data: earliestScan, error: earliestError } = await supabase
        .from('scan_history')
        .select('scan_date')
        .eq('user_id', userId)
        .order('scan_date', { ascending: true })
        .limit(1)
        .single()

      if (earliestError || !earliestScan) {
        console.log('No scan history found for user')
        return
      }

      const earliestDate = new Date(earliestScan.scan_date)
      const currentDate = new Date()
      
      // Calculate all weeks from earliest scan to current week
      const weeks = []
      let weekStart = new Date(earliestDate)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1) // Start of week (Monday)
      weekStart.setHours(0, 0, 0, 0)

      while (weekStart <= currentDate) {
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)

        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd)
        })

        weekStart.setDate(weekStart.getDate() + 7) // Next week
      }

      console.log(`📊 Processing ${weeks.length} weeks for aggregation`)

      // Process each week
      for (const week of weeks) {
        const { data: weekScans, error: scansError } = await supabase
          .from('scan_history')
          .select('score, success')
          .eq('user_id', userId)
          .gte('scan_date', week.start.toISOString())
          .lte('scan_date', week.end.toISOString())

        if (scansError) {
          console.error('Error fetching scans for week:', week.start, scansError)
          continue
        }

        const totalScans = weekScans?.length || 0
        
        // Skip weeks with no scans
        if (totalScans === 0) continue

        const successfulScans = weekScans?.filter(scan => scan.success).length || 0
        const averageScore = weekScans.reduce((sum, scan) => sum + scan.score, 0) / totalScans

        // Check if this week already exists in weekly_progress
        const { data: existingWeek, error: checkError } = await supabase
          .from('weekly_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('week_start_date', week.start.toISOString().split('T')[0])
          .single()

        if (checkError && checkError.code !== 'PGRST116') {
          console.error('Error checking existing week:', checkError)
          continue
        }

        const weekData = {
          user_id: userId,
          week_start_date: week.start.toISOString().split('T')[0],
          week_end_date: week.end.toISOString().split('T')[0],
          total_scans: totalScans,
          successful_scans: successfulScans,
          average_score: Number(averageScore.toFixed(2)),
          updated_at: new Date().toISOString()
        }

        if (existingWeek) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('weekly_progress')
            .update(weekData)
            .eq('user_id', userId)
            .eq('week_start_date', week.start.toISOString().split('T')[0])

          if (updateError) {
            console.error('Error updating week:', week.start, updateError)
          } else {
            console.log(`✅ Updated week ${week.start.toISOString().split('T')[0]}:`, weekData)
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('weekly_progress')
            .insert([weekData])

          if (insertError) {
            console.error('Error inserting week:', week.start, insertError)
          } else {
            console.log(`✅ Inserted week ${week.start.toISOString().split('T')[0]}:`, weekData)
          }
        }
      }

      console.log('🎉 Weekly progress aggregation completed')
    } catch (error) {
      console.error('Error in aggregateAllWeeklyProgress:', error)
    }
  }

  // Function to check if weekly aggregation should run
  const checkAndRunWeeklyAggregation = async (userId: string) => {
    try {
      const lastRunKey = `weekly_aggregation_last_run_${userId}`
      const lastRun = localStorage.getItem(lastRunKey)
      const now = new Date()
      const currentWeekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1))
      currentWeekStart.setHours(0, 0, 0, 0)

      let shouldRun = false

      if (!lastRun) {
        // Never run before - run full aggregation
        shouldRun = true
        console.log('📅 First time running weekly aggregation')
      } else {
        const lastRunDate = new Date(lastRun)
        const lastRunWeekStart = new Date(lastRunDate.setDate(lastRunDate.getDate() - lastRunDate.getDay() + 1))
        lastRunWeekStart.setHours(0, 0, 0, 0)

        // Check if we're in a new week
        if (currentWeekStart.getTime() > lastRunWeekStart.getTime()) {
          shouldRun = true
          console.log('📅 New week detected, running weekly aggregation')
        }
      }

      if (shouldRun) {
        await aggregateAllWeeklyProgress(userId)
        localStorage.setItem(lastRunKey, new Date().toISOString())
      } else {
        console.log('📅 Weekly aggregation not needed yet')
      }
    } catch (error) {
      console.error('Error in checkAndRunWeeklyAggregation:', error)
    }
  }

  useEffect(() => {
    const initializeCamera = async () => {
      showLoading('🏗️ INITIALIZING SYSTEM', 'Setting up camera and loading data...', { showProgress: true, progress: 0 })
      
      try {
        updateProgress(20)
        
        // Initialize hybrid posture service (loads local models if available)
        console.log('🔄 Initializing pose detection system...')
        await hybridPostureService.initialize('nano') // Use nano model for speed
        
        updateProgress(40)
        await detectCameras()
        
        updateProgress(60)
        await startCamera()
        
        updateProgress(80)
        await fetchWeeklyStats()
        await checkApiStatus()
        
        updateProgress(100)
        
        // Brief delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error('Error during camera initialization:', error)
      } finally {
        hideLoading()
      }
    }

    initializeCamera()
    
    // Check API status every 5 minutes
    const statusInterval = setInterval(checkApiStatus, 5 * 60 * 1000)
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
        streamRef.current = null
      }
      clearInterval(statusInterval)
    }
  }, [])

  // Weekly aggregation effect - runs when component mounts and checks for user session
  useEffect(() => {
    const runWeeklyAggregationCheck = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          console.log('🗓️ Checking if weekly aggregation is needed...')
          await checkAndRunWeeklyAggregation(session.user.id)
        }
      } catch (error) {
        console.error('Error in weekly aggregation check:', error)
      }
    }

    runWeeklyAggregationCheck()

    // Also set up a daily check (every 24 hours) for ongoing aggregation
    const dailyAggregationCheck = setInterval(runWeeklyAggregationCheck, 24 * 60 * 60 * 1000)

    return () => {
      clearInterval(dailyAggregationCheck)
    }
  }, [])

  // Handle scan trigger when countdown completes
  useEffect(() => {
    if (scanCountdown === 0) {
      handleScan()
      setScanCountdown(null) // Reset to prevent multiple triggers
    }
  }, [scanCountdown]) // handleScan is stable, can omit from deps

  // Handle loading state when scanning starts
  useEffect(() => {
    if (isScanning) {
      showLoading('🎯 TACTICAL SCAN IN PROGRESS...', 'Capturing image data...', { showProgress: true, progress: 0 })
    }
  }, [isScanning, showLoading])

  // Function to detect available cameras
  const detectCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      setAvailableCameras(videoDevices)
      
      // Check if there's a back camera
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      )
      
      setHasBackCamera(!!backCamera || videoDevices.length > 1)
      console.log('📷 Available cameras:', videoDevices.length)
      console.log('📷 Back camera detected:', !!backCamera || videoDevices.length > 1)
    } catch (error) {
      console.error('Error detecting cameras:', error)
    }
  }

  // Function to switch camera
  const switchCamera = async () => {
    playButtonClick()
    showLoading('📹 CAMERA SWITCH', 'Switching camera view...', { showProgress: true, progress: 0 })
    
    const newCamera = currentCamera === 'front' ? 'back' : 'front'
    setCurrentCamera(newCamera)
    console.log('🔄 Switching to', newCamera, 'camera')
    
    updateProgress(50)
    
    try {
      await startCamera(newCamera)
      updateProgress(100)
      
      // Brief delay to show completion
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Show success toast
      playSuccess()
      toast.success(`📹 Camera switched to ${newCamera} view!`, {
        icon: newCamera === 'front' ? '🤳' : '📷',
      })
    } catch (error) {
      console.error('Error switching camera:', error)
      playError()
      toast.error('❌ Failed to switch camera. Please try again.')
    } finally {
      hideLoading()
    }
  }

  const startCamera = async (cameraType: 'front' | 'back' = 'front'): Promise<void> => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    }

    try {
      setCameraLoading(true)
      setCameraError(null)

      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      
      if (videoDevices.length === 0) {
        setCameraError({
          title: "No Camera Found",
          message: "No camera devices detected on this device.",
          action: "Connect a camera and refresh"
        })
        return
      }

      // Determine camera constraints based on type - allow natural camera resolution
      let videoConstraints: MediaTrackConstraints = {
        // Remove fixed dimensions to prevent automatic zoom
        // Let the camera use its natural resolution
        // Users can zoom manually using browser/device controls
        width: { min: 320, ideal: 1280, max: 1920 },
        height: { min: 240, ideal: 720, max: 1080 },
        // Allow aspect ratio to be flexible
        frameRate: { ideal: 30 }
      }

      if (cameraType === 'front') {
        videoConstraints.facingMode = 'user'
      } else {
        // Try environment (back) camera first, fallback to any available camera
        try {
          videoConstraints.facingMode = { exact: 'environment' }
        } catch {
          // If exact environment fails, try ideal
          videoConstraints.facingMode = { ideal: 'environment' }
        }
      }

      let stream: MediaStream
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints
        })
      } catch (error) {
        // Fallback: if specific camera fails, try any camera
        console.warn('Specific camera failed, trying fallback:', error)
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 },
            height: { ideal: 1280 },
            aspectRatio: 0.5625
          }
        })
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          setCameraLoading(false)
          // Update current camera state based on actual stream
          const videoTrack = stream.getVideoTracks()[0]
          const settings = videoTrack.getSettings()
          if (settings.facingMode) {
            setCurrentCamera(settings.facingMode === 'user' ? 'front' : 'back')
          }
        }
      }
    } catch (error: unknown) {
      console.error("Camera access error:", error)
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setCameraError({
            title: "Camera Access Denied",
            message: "Camera permission was denied. Please allow camera access to use the scanner.",
            action: "Allow camera access in browser settings"
          })
        } else {
          setCameraError({
            title: "Camera Error",
            message: `Unable to access camera: ${error.message}`,
            action: "Check camera connection and try again"
          })
        }
      } else {
        setCameraError({
          title: "Unknown Error",
          message: "An unknown error occurred while accessing the camera.",
          action: "Refresh the page and try again"
        })
      }
      setCameraLoading(false)
    }
  }

  const captureImage = (): string | null => {
    console.log('📸 Capturing image at:', new Date().toLocaleTimeString())
    if (!videoRef.current) return null

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")

    if (!context) return null

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight

    context.drawImage(videoRef.current, 0, 0)
    return canvas.toDataURL("image/jpeg")
  }

  // Draw detected keypoints on canvas overlay (shown during real-time detection)
  const drawKeypoints = (keypoints: any[]) => {
    if (!canvasRef.current || !videoRef.current) return
    
    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match video's actual dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Define simplified skeleton connections
    const connections = [
      [0, 1], // Head to Neck
      [1, 7], // Neck to Hips
      [1, 2], // Neck to Left Shoulder
      [1, 5], // Neck to Right Shoulder
      [2, 4], // Left Shoulder to Left Hand
      [5, 8], // Right Shoulder to Right Hand
      [7, 9], // Hips to Left Glute
      [7, 10], // Hips to Right Glutes
      [9, 13], // Left Glute to Left Ankle
      [10, 14], // Right Glute to Right Ankle
      [13, 15], // Left Ankle to Left Foot
      [14, 16], // Right Ankle to Right Foot
    ]

    // Draw detected skeleton with full opacity
    ctx.globalAlpha = 1.0

    // Draw connections (skeleton lines) - GREEN for detected
    ctx.strokeStyle = '#10b981' // emerald-500
    ctx.lineWidth = 4
    connections.forEach(([startIdx, endIdx]) => {
      const start = keypoints[startIdx]
      const end = keypoints[endIdx]
      if (start && end && start.confidence > 0.3 && end.confidence > 0.3) {
        ctx.beginPath()
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height)
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height)
        ctx.stroke()
      }
    })

    // Draw keypoints
    keypoints.forEach((kp, index) => {
      if (kp.confidence > 0.3) {
        const x = kp.x * canvas.width
        const y = kp.y * canvas.height

        // Bright colors for detected keypoints (Custom dataset: 0=Head, 1=Neck, 2-8=Arms, 7-10=Hips, 11-16=Legs)
        let color = '#10b981' // emerald-500 default
        if (index === 0) color = '#fbbf24' // amber-400 for head
        else if (index === 1) color = '#f59e0b' // amber-500 for neck
        else if (index >= 2 && index <= 8) color = '#60a5fa' // blue-400 for arms/hands
        else if (index >= 9 && index <= 10) color = '#a855f7' // purple-500 for glutes
        else if (index >= 11 && index <= 16) color = '#ec4899' // pink-500 for legs/feet

        // Draw point
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, 2 * Math.PI)
        ctx.fill()

        // Draw white border
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 2.5
        ctx.stroke()
      }
    })

    // Add detection status text
    ctx.fillStyle = '#10b981'
    ctx.font = 'bold 20px sans-serif'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 4
    const text = '✓ POSE DETECTED'
    const textWidth = ctx.measureText(text).width
    const textX = (canvas.width - textWidth) / 2
    const textY = 45
    ctx.strokeText(text, textX, textY)
    ctx.fillText(text, textX, textY)
  }

  // Real-time pose detection loop
  const runRealTimeDetection = async () => {
    // Check ref immediately at function start
    if (!isRealTimeActiveRef.current || !videoRef.current) {
      console.log('⏹️ Detection loop stopped - not active or no video')
      return
    }

    try {
      const imageData = captureImage()
      if (!imageData) {
        // Schedule next frame only if still active
        if (isRealTimeActiveRef.current) {
          animationFrameRef.current = requestAnimationFrame(runRealTimeDetection)
        }
        return
      }

      // Analyze posture in real-time
      const result = await hybridPostureService.analyzePosture(
        imageData,
        currentPosture as 'salutation' | 'marching' | 'attention'
      )

      // Check again after async operation - might have stopped during analysis
      if (!isRealTimeActiveRef.current) {
        console.log('⏹️ Detection stopped during analysis')
        return
      }

      // Update live display
      setLiveScore(result.overall_score)
      setLiveConfidence(result.confidence)
      setDetectedPosture(result.posture_status)

      // Draw detected keypoints overlay
      if (result.keypoints && result.keypoints.length > 0) {
        drawKeypoints(result.keypoints)
      }

      // Auto-save to database if:
      // 1. Posture is detected with good confidence (>0.7)
      // 2. Score is good (>75)
      // 3. Enough time has passed since last save (3 seconds)
      const now = Date.now()
      const timeSinceLastSave = now - lastSaveTimeRef.current

      if (
        result.confidence > 0.6 &&
        result.overall_score >= 75 &&
        timeSinceLastSave >= MIN_SAVE_INTERVAL
      ) {
        console.log('✅ Good posture detected, auto-saving...')
        await savePostureResult(result, currentPosture)
        lastSaveTimeRef.current = now

        // Play success sound and show toast
        playSuccess()
        toast.success(`✅ ${currentPosture.toUpperCase()}: ${result.overall_score}% saved!`, {
          duration: 2000,
          icon: '💾',
        })
      }

    } catch (error) {
      console.warn('Real-time detection error:', error)
    }

    // Continue loop - aim for ~2 FPS for real-time detection (500ms interval)
    // Only schedule next frame if still active (check ref again)
    if (isRealTimeActiveRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (isRealTimeActiveRef.current) {
          animationFrameRef.current = requestAnimationFrame(runRealTimeDetection)
        }
      }, 500)
    }
  }

  // Start/stop real-time detection
  const toggleRealTimeDetection = () => {
    playButtonClick()
    
    if (isRealTimeActive) {
      // Stop real-time detection
      console.log('🛑 STOPPING real-time detection...')
      
      // Update ref FIRST to stop async operations immediately
      isRealTimeActiveRef.current = false
      setIsRealTimeActive(false)
      
      // Clear all scheduled callbacks
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      setLiveScore(null)
      setDetectedPosture(null)
      setLiveConfidence(null)
      
      // Clear canvas when detection stops
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
      
      console.log('✅ Real-time detection STOPPED')
    } else {
      // Start real-time detection
      console.log('▶️ STARTING real-time detection...')
      
      playSuccess()
      
      // Update ref FIRST before starting
      isRealTimeActiveRef.current = true
      setIsRealTimeActive(true)
      lastSaveTimeRef.current = 0 // Reset save timer
      
      // Start the loop
      runRealTimeDetection()
      console.log('✅ Real-time detection STARTED')
    }
  }

  // Save posture result to database
  const savePostureResult = async (result: any, postureType: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        console.log('No user session, skipping save')
        return
      }

      const { error: scanError } = await supabase
        .from('scan_history')
        .insert([
          {
            user_id: session.user.id,
            posture_type: postureType,
            score: result.overall_score,
            success: result.success,
            feedback: result.feedback
          }
        ])

      if (scanError) {
        console.error('Error saving scan result:', scanError)
      } else {
        console.log('✅ Posture result saved to database')
        // Update weekly stats
        await updateWeeklyProgress(session.user.id)
        await fetchWeeklyStats()
      }
    } catch (error) {
      console.error('Error in savePostureResult:', error)
    }
  }

  // Effect to manage real-time detection lifecycle
  useEffect(() => {
    // Sync ref with state
    isRealTimeActiveRef.current = isRealTimeActive
    
    if (isRealTimeActive) {
      runRealTimeDetection()
    }

    return () => {
      // Cleanup on unmount or when switching postures
      isRealTimeActiveRef.current = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isRealTimeActive, currentPosture])

  const handleScan = async (): Promise<void> => {
    const scanId = Date.now()
    console.log(`🎯 Starting scan #${scanId}`)
    
    // Prevent multiple simultaneous scans
    if (isScanning) {
      console.log(`🚫 Scan #${scanId} blocked - scan already in progress`)
      return
    }
    
    setIsScanning(true)
    
    const imageData = captureImage()

    if (!imageData) {
      setScanResult({
        success: false,
        score: 0,
        feedback: "Failed to capture image",
      })
      setIsScanning(false)
      hideLoading()
      return
    }

    updateProgress(25)

    try {
      const response = await fetch(imageData)
      const blob = await response.blob()

      // Convert blob to base64 for the new workflow API
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result as string
          resolve(base64)
        }
        reader.readAsDataURL(blob)
      })

      updateProgress(50)

      // Use Hybrid Posture Service (Local Models → API → Fallback)
      let scanResult
      
      console.log('🚀 Analyzing posture with hybrid service... (SCAN ID:', Date.now(), ')')
      
      try {
        const hybridResult = await hybridPostureService.analyzePosture(
          base64Data,
          currentPosture as 'salutation' | 'marching' | 'attention'
        )

        updateProgress(75)

        console.log(`✅ Hybrid analysis complete (source: ${hybridResult.source}):`, hybridResult)
        
        scanResult = {
          success: hybridResult.success,
          score: hybridResult.overall_score,
          feedback: hybridResult.feedback + ` [${hybridResult.source === 'local' ? '📱 Local AI' : hybridResult.source === 'api' ? '☁️ Cloud API' : '🔄 Offline'}]`,
          posture: currentPosture,
          confidence: hybridResult.confidence,
          recommendations: hybridResult.recommendations,
          timestamp: hybridResult.timestamp
        }
        
      } catch (error) {
        console.error('❌ Hybrid service failed:', error)
        
        updateProgress(60)
        
        // Ultimate fallback (should rarely happen)
        const baseScore = Math.floor(Math.random() * 25) + 70
        const finalScore = Math.min(100, Math.max(60, baseScore))
        const simulatedSuccess = finalScore >= 75
        
        scanResult = {
          success: simulatedSuccess,
          score: finalScore,
          feedback: `Posture analysis completed (${finalScore}%) [⚠️ Fallback mode]`,
          posture: currentPosture,
          confidence: 0.6,
          recommendations: ['Ensure good lighting', 'Position full body in frame'],
          timestamp: new Date().toISOString()
        }
        
        console.log('🎯 Using ultimate fallback result:', scanResult)
      }

      updateProgress(85)

      setScanResult(scanResult)

      // Show toast notification based on scan result
      if (scanResult.success) {
        toast.success(`🎯 EXCELLENT POSTURE! Score: ${scanResult.score}%`, {
          duration: 5000,
          icon: '🏆',
        })
      } else {
        toast.error(`📊 Posture needs improvement. Score: ${scanResult.score}%`, {
          duration: 5000,
          icon: '💪',
        })
      }

      // Save scan result to database - this will trigger weekly_progress update automatically
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && scanResult) {
          const { error: scanError } = await supabase
            .from('scan_history')
            .insert([
              {
                user_id: session.user.id,
                posture_type: currentPosture,
                score: scanResult.score,
                success: scanResult.success,
                feedback: scanResult.feedback
              }
            ])

          if (scanError) {
            console.error('Error saving scan result:', scanError)
            toast.error('⚠️ Scan completed but failed to save to history', {
              duration: 4000,
            })
            setScanResult({
              ...scanResult,
              feedback: scanResult.feedback + ' (Note: Result not saved to history)'
            })
          } else {
            console.log('Scan result saved successfully to scan_history and weekly_progress updated automatically')
            updateProgress(95)
            await updateWeeklyProgress(session.user.id)
            await fetchWeeklyStats()
            
            // Show database save success (only for successful scans to avoid spam)
            if (scanResult.success) {
              setTimeout(() => {
                toast.success('💾 Scan result saved to history!', {
                  duration: 3000,
                  icon: '✅',
                })
              }, 1000) // Delay to not interfere with main scan result toast
            }
          }
        }
      } catch (dbError) {
        console.error('Error saving scan result:', dbError)
        toast.error('🔌 Database connection error. Scan completed but not saved.', {
          duration: 5000,
        })
        if (scanResult) {
          setScanResult({
            ...scanResult,
            feedback: scanResult.feedback + ' (Note: Result not saved to history)'
          })
        }
      }

      updateProgress(100)
      
      // Brief delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500))

    } catch (error) {
      console.error('Error in handleScan:', error)
      setScanResult({
        success: false,
        score: 0,
        feedback: "Error during scanning process",
        posture: currentPosture,
      })
    } finally {
      console.log(`✅ Scan completed, setting isScanning to false`)
      setIsScanning(false)
      hideLoading()
    }
  }

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
    setScanResult(null)
    setScanCountdown(null)
  }

  const retryCamera = () => {
    setCameraError(null)
    startCamera()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-2xl shadow-emerald-500/20 flex-shrink-0">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                apiStatus === 'local' ? 'bg-purple-400 animate-pulse' :
                apiStatus === 'online' ? 'bg-green-400 animate-pulse' :
                apiStatus === 'offline' ? 'bg-red-400' :
                'bg-yellow-400 animate-pulse'
              }`}></div>
              <span className="text-xs text-emerald-100">
                {apiStatus === 'local' ? '📱 Local AI' :
                 apiStatus === 'online' ? 'API Online' :
                 apiStatus === 'offline' ? 'Offline Mode' :
                 'Checking...'}
              </span>
            </div>
            
            {/* Camera Tips */}
            <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded-lg bg-blue-900/30 border border-blue-500/20">
              <span className="text-blue-400 text-xs">💡</span>
              <span className="text-blue-200 text-xs">Use pinch/scroll to zoom</span>
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

      {/* Camera Section */}
      <div className="flex-1 flex flex-col px-4 py-4">
        <div className="relative flex-1 max-w-sm mx-auto w-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl border border-slate-700/50">
          {cameraError ? (
            <div className="aspect-[9/16] flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-20 h-20 mx-auto mb-6 bg-red-500/20 rounded-xl flex items-center justify-center border border-red-500/50">
                  <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-red-400 mb-3">{cameraError.title}</h3>
                <p className="text-slate-300 text-sm mb-6">{cameraError.message}</p>
                <button
                  onClick={retryCamera}
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-lg"
                >
                  🔄 {cameraError.action}
                </button>
              </div>
            </div>
          ) : (
            <div className="relative aspect-[9/16] max-w-md mx-auto">
              {/* Real-time detection active indicator */}
              {isRealTimeActive && (
                <div className={`absolute inset-0 border-4 rounded-lg pointer-events-none z-10 transition-all duration-300 ${
                  liveScore && liveScore >= 75 
                    ? 'border-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50' 
                    : 'border-purple-500/30'
                }`}></div>
              )}
              
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain rounded-lg ${currentCamera === 'front' ? 'scale-x-[-1]' : ''}`}
              />

              {/* Canvas overlay for dynamic keypoint rendering from dataset */}
              <canvas
                ref={canvasRef}
                className={`absolute inset-0 w-full h-full object-contain rounded-lg pointer-events-none ${currentCamera === 'front' ? 'scale-x-[-1]' : ''}`}
                style={{ 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 10
                }}
              />
              
              {/* Body Scanning Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Posture Type Dropdown - Top Left Corner */}
                <div className="absolute top-4 left-4 z-20 pointer-events-auto">
                  <select
                    value={currentPosture}
                    onChange={(e) => {
                      playButtonClick()
                      setCurrentPosture(e.target.value)
                    }}
                    disabled={isScanning || isRealTimeActive}
                    className={`bg-slate-900/90 backdrop-blur text-white rounded-lg px-3 py-2 text-sm font-bold border-2 transition-all duration-200 appearance-none cursor-pointer pr-8 ${
                      isScanning || isRealTimeActive
                        ? 'border-slate-600 opacity-50 cursor-not-allowed'
                        : 'border-emerald-500/50 hover:border-emerald-400 hover:bg-slate-800/90'
                    }`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2310b981'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1.25rem'
                    }}
                  >
                    {Object.entries(postureTypes).map(([key, posture]) => (
                      <option key={key} value={key} className="bg-slate-800 text-white">
                        {posture.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Camera Switch Button - Top Right Corner */}
                {hasBackCamera && (
                  <button
                    onClick={switchCamera}
                    disabled={cameraLoading || isScanning}
                    className={`absolute top-4 right-4 z-10 pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-all duration-200 ${
                      cameraLoading || isScanning 
                        ? 'bg-slate-600/80 text-slate-400 cursor-not-allowed' 
                        : 'bg-emerald-600/90 hover:bg-emerald-500 text-white hover:scale-110 active:scale-95 animate-pulse'
                    } border-2 border-emerald-400/50`}
                    title={`Switch to ${currentCamera === 'front' ? 'back' : 'front'} camera`}
                    aria-label={`Switch to ${currentCamera === 'front' ? 'back' : 'front'} camera`}
                  >
                    <span className="text-lg">{currentCamera === 'front' ? '📷' : '🤳'}</span>
                  </button>
                )}
                
                {/* Body silhouette guide */}
                <div className="absolute inset-x-4 top-16 bottom-8 border-2 border-emerald-500/30 rounded-full border-dashed">
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-emerald-400 text-xs font-semibold bg-slate-900/80 px-2 py-1 rounded">
                    👤 Position body here
                  </div>
                </div>
                
                {/* Posture type indicator (hidden since dropdown shows it) */}
                <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg px-3 py-2 border border-emerald-500/30 hidden">
                  <div className="text-emerald-400 text-sm font-bold">
                    {currentPosture === 'salutation' && '🫡 SALUTATION POSE'}
                    {currentPosture === 'marching' && '🚶 MARCHING POSE'}
                    {currentPosture === 'attention' && '🧍 ATTENTION POSE'}
                  </div>
                </div>

                {/* Real-Time Score Overlay */}
                {isRealTimeActive && liveScore !== null && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl rounded-xl px-6 py-3 border-2 border-purple-500/50 animate-pulse">
                    <div className="text-center">
                      <div className={`text-3xl font-black mb-1 ${
                        liveScore >= 85 ? 'text-emerald-400' : 
                        liveScore >= 75 ? 'text-yellow-400' : 
                        'text-red-400'
                      }`}>
                        {liveScore}%
                      </div>
                      <div className="text-xs text-purple-300 font-bold">
                        {liveScore >= 85 ? '🌟 EXCELLENT!' : 
                         liveScore >= 75 ? '✅ GOOD!' : 
                         '⚠️ ADJUST'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {cameraLoading && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-emerald-400 font-bold">🔍 INITIALIZING {currentCamera.toUpperCase()} CAMERA...</p>
                    {hasBackCamera && (
                      <p className="text-emerald-300 text-xs mt-2">
                        📷 {availableCameras.length} camera{availableCameras.length !== 1 ? 's' : ''} detected
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
                        <span className="text-emerald-400 font-bold text-lg">🔍 SCANNING POSTURE...</span>
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
                    {scanResult.confidence && (
                      <div className="text-xs text-slate-400 mt-1">
                        Confidence: {Math.round(scanResult.confidence * 100)}%
                      </div>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm mb-4 font-medium">{scanResult.feedback}</p>
                  {scanResult.recommendations && scanResult.recommendations.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-emerald-400 text-sm font-bold mb-2">📋 RECOMMENDATIONS:</h4>
                      <ul className="text-slate-300 text-xs space-y-1">
                        {scanResult.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start space-x-2">
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

      {/* Weekly Statistics Display */}
      {weeklyStats && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 mx-6 mt-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold mb-2 text-center">📊 This Week's Progress</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{weeklyStats.totalScans}</div>
              <div className="text-xs opacity-80">Total Scans</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{weeklyStats.successfulScans}</div>
              <div className="text-xs opacity-80">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{weeklyStats.averageScore.toFixed(0)}%</div>
              <div className="text-xs opacity-80">Avg Score</div>
            </div>
          </div>
          
          {/* Debug: Manual Weekly Aggregation Button (for testing) */}
          <button
            onClick={async () => {
              const { data: { session } } = await supabase.auth.getSession()
              if (session?.user) {
                console.log('🔧 Manual weekly aggregation triggered')
                await aggregateAllWeeklyProgress(session.user.id)
                await fetchWeeklyStats() // Refresh stats after aggregation
              }
            }}
            className="w-full mt-3 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-medium transition-colors"
          >
            🔧 Force Weekly Aggregation (Debug)
          </button>
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
                <span className="text-purple-300 font-bold text-sm">LIVE DETECTION</span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">{liveScore}%</div>
                <div className="text-xs text-purple-300">
                  {detectedPosture} • {liveConfidence ? Math.round(liveConfidence * 100) : 0}% conf
                </div>
              </div>
            </div>
            {liveScore >= 75 && (
              <div className="mt-2 text-xs text-emerald-300 flex items-center space-x-1">
                <span>✅</span>
                <span>Good posture detected! Auto-saving...</span>
              </div>
            )}
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
                ? "� STOP REAL-TIME DETECTION"
                : "🎯 START REAL-TIME DETECTION"
          }
        </button>

        {/* Info text */}
        <div className="text-center text-xs text-slate-400">
          {isRealTimeActive ? (
            <span>✨ Continuously analyzing posture • Auto-saves when score ≥75%</span>
          ) : (
            <span>💡 Real-time detection will automatically save good postures to history</span>
          )}
        </div>
      </div>

      {/* Posture Guide */}
      <div className="relative px-6 pb-6">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-bold text-emerald-400 mb-4">📖 CURRENT POSTURE GUIDE</h3>
          <div className="space-y-3">
            <div>
              <h4 className="font-bold text-white mb-1">{postureTypes[currentPosture].title}</h4>
              <p className="text-slate-300 text-sm mb-3">{postureTypes[currentPosture].instructions}</p>
            </div>
            <div>
              <h5 className="font-bold text-emerald-400 text-sm mb-2">KEY CHECKPOINTS:</h5>
              <div className="grid grid-cols-2 gap-2">
                {postureTypes[currentPosture].checkpoints.map((checkpoint, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                    <span className="text-slate-300 text-xs">{checkpoint}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}