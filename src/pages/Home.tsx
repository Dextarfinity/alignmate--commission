import React, { useState, useCallback, Suspense, lazy } from 'react'
import { useNavigate } from 'react-router'
import { useUserData } from '../hooks/useUserData'
import { useAudio } from '../contexts/AudioContext'

// Lazy load components for better performance
const RecentScans = lazy(() => import('../components/RecentScans'))

// Constants - predefined secure avatar paths (no file uploads allowed)
const AVATAR_OPTIONS = [
  { id: 'soldier', name: 'Soldier', path: '/avatars/soldier.png' },
  { id: 'cadet', name: 'Cadet', path: '/avatars/cadet.png' },
  { id: 'helmet', name: 'Helmet', path: '/avatars/helmet.png' },
  { id: 'badge', name: 'Badge', path: '/avatars/badge.png' },
  { id: 'girl', name: 'Female Officer', path: '/avatars/girl.png' },
  { id: 'gun', name: 'Weapon Specialist', path: '/avatars/gun.png' },
  { id: 'tank', name: 'Tank Commander', path: '/avatars/tank.png' },
  { id: 'parachute', name: 'Paratrooper', path: '/avatars/parachute.png' },
  { id: 'flag', name: 'Flag Bearer', path: '/avatars/flag.png' },
  { id: 'aim', name: 'Marksman', path: '/avatars/aim.png' }
] as const

const STORAGE_KEY = 'alignmate_selected_avatar'

// Error boundary component
const ErrorFallback: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
      <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-red-400 text-2xl">⚠️</span>
      </div>
      <h2 className="text-white text-xl font-bold mb-2">Something went wrong</h2>
      <p className="text-gray-400 text-sm mb-6">{error}</p>
      <button
        onClick={onRetry}
        className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
      >
        Try Again
      </button>
    </div>
  </div>
)

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { playButtonClick } = useAudio()
  
  // Use comprehensive user data hook
  const {
    profile,
    stats,
    recentScans,
    loading,
    error
  } = useUserData()
  
  // Local state for avatar selection
  const [showAvatarSelection, setShowAvatarSelection] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string>('soldier')

  // Load selected avatar from localStorage
  React.useEffect(() => {
    const savedAvatar = localStorage.getItem(STORAGE_KEY)
    if (savedAvatar && AVATAR_OPTIONS.find(avatar => avatar.id === savedAvatar)) {
      setSelectedAvatar(savedAvatar)
    }
  }, [])

  // Get current avatar data
  const currentAvatar = AVATAR_OPTIONS.find(avatar => avatar.id === selectedAvatar) || AVATAR_OPTIONS[0]

  // Avatar change handler - now uses localStorage instead of database
  const handleAvatarChange = useCallback(async (avatarId: string) => {
    try {
      setShowAvatarSelection(false)
      setSelectedAvatar(avatarId)
      localStorage.setItem(STORAGE_KEY, avatarId)
      console.log('✅ Avatar saved to localStorage:', avatarId)
    } catch (err) {
      console.error('Failed to update avatar:', err)
    }
  }, [])

  const handleRetry = useCallback(() => {
    // Error handling is now managed by the useUserData hook
  }, [])

  // Error state
  if (error && !profile) {
    return <ErrorFallback error={error} onRetry={handleRetry} />
  }

  // Loading state
  if (loading.profile && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-xl">Loading...</p>
        </div>
      </div>
    )
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
  const totalScans = stats.total_scans
  const avgScore = stats.avg_score
  const successfulScans = stats.successful_scans
  const successRate = stats.success_rate

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6">
      {/* Error notification */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Header Profile Section */}
      <div className="mb-8">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
          <div className="flex items-center space-x-4">
            <div className="relative group cursor-pointer" onClick={() => {
              playButtonClick()
              setShowAvatarSelection(true)
            }}>
              <img
                src={currentAvatar.path}
                alt={currentAvatar.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50 group-hover:border-emerald-400 transition-all duration-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = AVATAR_OPTIONS[0].path // Fallback to first avatar
                }}
              />
              <div className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <span className="text-white text-xs font-bold">EDIT</span>
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">{fullName || 'User'}</h2>
              <p className="text-gray-300">{profile?.email}</p>
              <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                <span>ID: {profile?.id_number || 'N/A'}</span>
                <span>Age: {profile?.age || 'N/A'}</span>
                <span>Avatar: {currentAvatar.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-emerald-400">{totalScans}</div>
          <div className="text-sm text-gray-400">Total Scans</div>
        </div>
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-emerald-400">{avgScore}%</div>
          <div className="text-sm text-gray-400">Avg Score</div>
        </div>
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-emerald-400">{successRate}%</div>
          <div className="text-sm text-gray-400">Success Rate</div>
        </div>
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 text-center">
          <div className="text-2xl font-bold text-emerald-400">{successfulScans}</div>
          <div className="text-sm text-gray-400">Successful</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button
          onClick={() => {
            playButtonClick()
            navigate('/camera')
          }}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 rounded-2xl text-white font-bold text-lg hover:from-emerald-500 hover:to-emerald-600 transition-all duration-200 shadow-xl"
        >
          <div className="flex items-center justify-center space-x-3">
            <span className="text-2xl">📸</span>
            <span>Start New Scan</span>
          </div>
        </button>
        <button
          onClick={() => {
            playButtonClick()
            navigate('/settings')
          }}
          className="bg-gradient-to-r from-gray-700 to-gray-800 p-6 rounded-2xl text-white font-bold text-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-xl"
        >
          <div className="flex items-center justify-center space-x-3">
            <span className="text-2xl">⚙️</span>
            <span>Settings</span>
          </div>
        </button>
      </div>

      {/* Recent Scans */}
      <div className="bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
        <h3 className="text-xl font-bold text-white mb-4">Recent Scans</h3>
        <Suspense fallback={<div className="text-center py-8 text-gray-400">Loading scans...</div>}>
          <RecentScans scans={recentScans.map(scan => ({
            id: scan.id,
            postureType: scan.posture_type.charAt(0).toUpperCase() + scan.posture_type.slice(1),
            score: scan.score,
            success: scan.success,
            date: new Date(scan.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }))} />
        </Suspense>
      </div>

      {/* Avatar Selection Modal */}
      {showAvatarSelection && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full border border-gray-700 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Choose Avatar</h3>
              <button
                onClick={() => {
                  playButtonClick()
                  setShowAvatarSelection(false)
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {AVATAR_OPTIONS.map((avatar) => {
                const isSelected = selectedAvatar === avatar.id
                return (
                  <button
                    key={avatar.id}
                    onClick={() => {
                      playButtonClick()
                      handleAvatarChange(avatar.id)
                    }}
                    className={`relative p-2 rounded-xl transition-all duration-200 ${
                      isSelected 
                        ? 'bg-emerald-500/20 border-2 border-emerald-500' 
                        : 'bg-gray-700/50 border-2 border-gray-600 hover:border-emerald-400'
                    }`}
                  >
                    <img
                      src={avatar.path}
                      alt={avatar.name}
                      className="w-full aspect-square rounded-lg object-cover mb-1"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none' // Hide broken images
                      }}
                    />
                    <p className="text-white text-xs font-semibold text-center">{avatar.name}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-emerald-300 text-xs">
                🔒 Avatars are stored locally for security. No file uploads allowed.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Home