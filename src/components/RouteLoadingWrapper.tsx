import React, { useEffect, useState, Suspense } from 'react'
import { useLocation } from 'react-router'
import LoadingScreen from './LoadingScreen'
import { useLoading } from '../contexts/LoadingContext'

interface RouteLoadingWrapperProps {
  children: React.ReactNode
}

const RouteLoadingWrapper: React.FC<RouteLoadingWrapperProps> = ({ children }) => {
  const location = useLocation()
  const { showLoading, hideLoading, setLoadingMessage } = useLoading()
  const [isTransitioning, setIsTransitioning] = useState(false)

  // Route-specific loading messages
  const getRouteLoadingMessage = (pathname: string) => {
    switch (pathname) {
      case '/':
      case '/landing':
        return {
          message: 'ACCESSING COMMAND CENTER...',
          submessage: 'Loading tactical interface'
        }
      case '/auth':
        return {
          message: 'AUTHENTICATING PERSONNEL...',
          submessage: 'Verifying security credentials'
        }
      case '/home':
        return {
          message: 'LOADING MISSION CONTROL...',
          submessage: 'Initializing user dashboard'
        }
      case '/camera':
        return {
          message: 'ACTIVATING SCANNER...',
          submessage: 'Calibrating posture detection system'
        }
      case '/settings':
        return {
          message: 'ACCESSING SYSTEM CONFIG...',
          submessage: 'Loading user preferences'
        }
      default:
        return {
          message: 'LOADING SYSTEM...',
          submessage: 'Initializing tactical interface'
        }
    }
  }

  useEffect(() => {
    // Show loading when route changes
    setIsTransitioning(true)
    const { message, submessage } = getRouteLoadingMessage(location.pathname)
    
    showLoading(message, submessage)

    // Simulate resource loading time
    const timer = setTimeout(() => {
      hideLoading()
      setIsTransitioning(false)
    }, 1000) // Minimum 1 second loading time for smooth UX

    return () => {
      clearTimeout(timer)
    }
  }, [location.pathname, showLoading, hideLoading])

  // Resource loading simulation for different routes
  useEffect(() => {
    if (!isTransitioning) return

    let progressTimer: NodeJS.Timeout
    let progress = 0

    const updateProgress = () => {
      progress += Math.random() * 30 + 10 // Random progress increments
      if (progress >= 100) {
        progress = 100
        clearInterval(progressTimer)
        return
      }

      // Update loading message based on progress
      if (progress < 30) {
        setLoadingMessage(getRouteLoadingMessage(location.pathname).message, 'Loading assets...')
      } else if (progress < 60) {
        setLoadingMessage(getRouteLoadingMessage(location.pathname).message, 'Initializing components...')
      } else if (progress < 90) {
        setLoadingMessage(getRouteLoadingMessage(location.pathname).message, 'Finalizing setup...')
      } else {
        setLoadingMessage(getRouteLoadingMessage(location.pathname).message, 'System ready')
      }
    }

    progressTimer = setInterval(updateProgress, 200)

    return () => {
      clearInterval(progressTimer)
    }
  }, [isTransitioning, location.pathname, setLoadingMessage])

  return (
    <Suspense 
      fallback={
        <LoadingScreen 
          message="LOADING COMPONENTS..."
          submessage="Preparing tactical interface"
        />
      }
    >
      {children}
    </Suspense>
  )
}

export default RouteLoadingWrapper