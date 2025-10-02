import React from 'react'

interface LoadingScreenProps {
  message?: string
  submessage?: string
  progress?: number
  showProgress?: boolean
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "LOADING SYSTEM...", 
  submessage = "Initializing tactical interface",
  progress = 0,
  showProgress = false 
}) => {
  return (
    <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-lg backdrop-saturate-150 animate-backdrop-pulse flex items-center justify-center z-[9999]">
      {/* Enhanced backdrop overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 via-slate-800/30 to-slate-900/50"></div>
      
      {/* Military grid background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(5,150,105,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(5,150,105,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Loading content */}
      <div className="relative text-center px-8 max-w-md">
        {/* Military logo/emblem */}
        <div className="mb-8 relative">
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/25 relative">
            <span className="text-white text-3xl font-bold">🎯</span>
            
            {/* Rotating border */}
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-t-emerald-300 animate-spin animate-reverse delay-300"></div>
          </div>
          
          {/* Pulse rings */}
          <div className="absolute inset-0 w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping"></div>
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping delay-500"></div>
          </div>
        </div>

        {/* Loading text */}
        <div className="mb-6">
          <h2 className="text-2xl font-black text-white mb-2 tracking-wider">
            {message}
          </h2>
          <p className="text-emerald-300 text-sm font-medium">
            {submessage}
          </p>
        </div>

        {/* Progress bar (if enabled) */}
        {showProgress && (
          <div className="mb-6">
            <div className="w-full bg-slate-700/50 rounded-full h-2 mb-2 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
            </div>
            <p className="text-emerald-400 text-xs font-bold">
              {Math.round(progress)}% COMPLETE
            </p>
          </div>
        )}

        {/* Loading dots animation */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100"></div>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200"></div>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-300"></div>
        </div>

        {/* Military status indicator */}
        <div className="mt-8 flex items-center justify-center space-x-4 text-xs text-emerald-400">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>SYSTEM ONLINE</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse delay-200"></div>
            <span>SECURE CONNECTION</span>
          </div>
        </div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-emerald-500/50"></div>
      <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-emerald-500/50"></div>
      <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-emerald-500/50"></div>
      <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-emerald-500/50"></div>
    </div>
  )
}

export default LoadingScreen