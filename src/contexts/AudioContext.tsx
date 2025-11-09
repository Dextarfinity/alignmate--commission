import { createContext, useContext, useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface AudioContextType {
  isMusicEnabled: boolean
  isSfxEnabled: boolean
  toggleMusic: () => void
  toggleSfx: () => void
  playButtonClick: () => void
  playSuccess: () => void
  playError: () => void
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isMusicEnabled, setIsMusicEnabled] = useState<boolean>(true)
  const [isSfxEnabled, setIsSfxEnabled] = useState<boolean>(true)
  const [isAudioReady, setIsAudioReady] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  
  const bgMusicRef = useRef<HTMLAudioElement | null>(null)
  const sfxRef = useRef<HTMLAudioElement | null>(null)
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio elements
  useEffect(() => {
    // Create background music audio element
    bgMusicRef.current = new Audio('/assets/bgmusic.mp3')
    bgMusicRef.current.loop = true
    bgMusicRef.current.volume = 0 // Start at 0 for fade in

    // Create SFX audio element
    sfxRef.current = new Audio('/assets/sfx.mp3')
    sfxRef.current.volume = 0.5 // SFX at 50% volume

    // Load saved preferences from localStorage
    const savedMusicPref = localStorage.getItem('musicEnabled')
    const savedSfxPref = localStorage.getItem('sfxEnabled')
    
    if (savedMusicPref !== null) {
      setIsMusicEnabled(savedMusicPref === 'true')
    }
    if (savedSfxPref !== null) {
      setIsSfxEnabled(savedSfxPref === 'true')
    }

    setIsAudioReady(true)

    // Set up global click listener to handle first user interaction
    const handleFirstInteraction = () => {
      setHasUserInteracted(true)
      // Try to play music if it's enabled
      if (bgMusicRef.current && isMusicEnabled) {
        bgMusicRef.current.play().catch(() => {
          console.log('Audio playback will start after user interaction')
        })
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
    }

    document.addEventListener('click', handleFirstInteraction)
    document.addEventListener('touchstart', handleFirstInteraction)
    document.addEventListener('keydown', handleFirstInteraction)

    // Cleanup
    return () => {
      document.removeEventListener('click', handleFirstInteraction)
      document.removeEventListener('touchstart', handleFirstInteraction)
      document.removeEventListener('keydown', handleFirstInteraction)
      
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current)
      }
      if (bgMusicRef.current) {
        bgMusicRef.current.pause()
        bgMusicRef.current = null
      }
      if (sfxRef.current) {
        sfxRef.current = null
      }
    }
  }, [])

  // Handle background music on/off with fade
  useEffect(() => {
    if (!isAudioReady || !bgMusicRef.current) return

    if (isMusicEnabled) {
      // Fade in
      const playPromise = bgMusicRef.current.play()
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully
            fadeIn(bgMusicRef.current!, 0.15, 2000) // Fade to 15% volume (50% of original 30%)
          })
          .catch(() => {
            // Autoplay was prevented - will play after user interaction
            console.log('Background music will play after user interaction')
          })
      }
    } else {
      // Fade out
      fadeOut(bgMusicRef.current, 1000, () => {
        if (bgMusicRef.current) {
          bgMusicRef.current.pause()
        }
      })
    }

    // Save preference
    localStorage.setItem('musicEnabled', isMusicEnabled.toString())
  }, [isMusicEnabled, isAudioReady, hasUserInteracted])

  // Save SFX preference
  useEffect(() => {
    if (isAudioReady) {
      localStorage.setItem('sfxEnabled', isSfxEnabled.toString())
    }
  }, [isSfxEnabled, isAudioReady])

  // Fade in effect
  const fadeIn = (audio: HTMLAudioElement, targetVolume: number, duration: number) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
    }

    const steps = 50
    const stepDuration = duration / steps
    const volumeStep = targetVolume / steps
    let currentStep = 0

    audio.volume = 0

    fadeIntervalRef.current = setInterval(() => {
      currentStep++
      audio.volume = Math.min(volumeStep * currentStep, targetVolume)

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current)
        }
      }
    }, stepDuration)
  }

  // Fade out effect
  const fadeOut = (audio: HTMLAudioElement, duration: number, callback?: () => void) => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current)
    }

    const steps = 50
    const stepDuration = duration / steps
    const startVolume = audio.volume
    const volumeStep = startVolume / steps
    let currentStep = 0

    fadeIntervalRef.current = setInterval(() => {
      currentStep++
      audio.volume = Math.max(startVolume - (volumeStep * currentStep), 0)

      if (currentStep >= steps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current)
        }
        if (callback) callback()
      }
    }, stepDuration)
  }

  // Toggle functions
  const toggleMusic = () => {
    setIsMusicEnabled(prev => !prev)
  }

  const toggleSfx = () => {
    setIsSfxEnabled(prev => !prev)
  }

  // Play button click sound
  const playButtonClick = () => {
    if (!isSfxEnabled || !sfxRef.current) return
    
    // Clone and play to allow multiple simultaneous sounds
    const sfxClone = sfxRef.current.cloneNode() as HTMLAudioElement
    sfxClone.volume = 0.2 // 20% volume (50% of original 40%)
    sfxClone.play().catch(() => {})
  }

  // Play success sound (higher pitched)
  const playSuccess = () => {
    if (!isSfxEnabled || !sfxRef.current) return
    
    const sfxClone = sfxRef.current.cloneNode() as HTMLAudioElement
    sfxClone.volume = 0.25 // 25% volume (50% of original 50%)
    sfxClone.playbackRate = 1.2 // Higher pitch
    sfxClone.play().catch(() => {})
  }

  // Play error sound (lower pitched)
  const playError = () => {
    if (!isSfxEnabled || !sfxRef.current) return
    
    const sfxClone = sfxRef.current.cloneNode() as HTMLAudioElement
    sfxClone.volume = 0.25 // 25% volume (50% of original 50%)
    sfxClone.playbackRate = 0.8 // Lower pitch
    sfxClone.play().catch(() => {})
  }

  return (
    <AudioContext.Provider
      value={{
        isMusicEnabled,
        isSfxEnabled,
        toggleMusic,
        toggleSfx,
        playButtonClick,
        playSuccess,
        playError,
      }}
    >
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider')
  }
  return context
}
