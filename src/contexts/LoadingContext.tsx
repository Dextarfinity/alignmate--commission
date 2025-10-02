import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface LoadingState {
  isLoading: boolean
  message: string
  submessage: string
  progress?: number
  showProgress?: boolean
}

interface LoadingContextType {
  loadingState: LoadingState
  showLoading: (message?: string, submessage?: string, options?: { progress?: number; showProgress?: boolean }) => void
  hideLoading: () => void
  updateProgress: (progress: number) => void
  setLoadingMessage: (message: string, submessage?: string) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export const useLoading = () => {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}

interface LoadingProviderProps {
  children: ReactNode
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    message: 'LOADING SYSTEM...',
    submessage: 'Initializing tactical interface',
    progress: 0,
    showProgress: false
  })

  const showLoading = useCallback((
    message = 'LOADING SYSTEM...', 
    submessage = 'Initializing tactical interface',
    options: { progress?: number; showProgress?: boolean } = {}
  ) => {
    setLoadingState({
      isLoading: true,
      message,
      submessage,
      progress: options.progress || 0,
      showProgress: options.showProgress || false
    })
  }, [])

  const hideLoading = useCallback(() => {
    setLoadingState(prev => ({
      ...prev,
      isLoading: false
    }))
  }, [])

  const updateProgress = useCallback((progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress))
    }))
  }, [])

  const setLoadingMessage = useCallback((message: string, submessage?: string) => {
    setLoadingState(prev => ({
      ...prev,
      message,
      submessage: submessage || prev.submessage
    }))
  }, [])

  const value: LoadingContextType = {
    loadingState,
    showLoading,
    hideLoading,
    updateProgress,
    setLoadingMessage
  }

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  )
}

export default LoadingContext