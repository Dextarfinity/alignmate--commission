import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router'
import supabase from '../supabase'

// Lazy load components for better performance
const RecentScans = lazy(() => import('../components/RecentScans'))

// Constants - moved outside component to prevent re-creation on every render
const AVATAR_PATHS = [
  '/assets/avatar1.jpg',
  '/assets/avatar1.png', 
  '/assets/avatar2.jpeg',
  '/assets/avatar2.png',
  '/assets/avatar3.jpeg',
  '/assets/avatar3.png',
  '/assets/avatar4.png',
] as const

// Fallback avatar service for error handling
const generateFallbackAvatar = (name: string, index: number = 0) => {
  const colors = ['10b981', '3b82f6', 'ef4444', '8b5cf6', 'f59e0b', 'ec4899', '06b6d4']
  const color = colors[index % colors.length]
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${color}&color=fff&size=96`
}

// Type definitions
interface Scan {
  id: string
  postureType: string
  score: number
  success: boolean
  date: string
}

interface UserProfile {
  first_name: string
  last_name: string
  email: string
  id_number: string
  age: number
}

interface LoadingState {
  profile: boolean
  scans: boolean
  avatarUpdate: boolean
}

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
  
  // State management
  const [scans, setScans] = useState<Scan[]>([])
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState<LoadingState>({
    profile: true,
    scans: true,
    avatarUpdate: false
  })
  const [error, setError] = useState<string | null>(null)

  // Memoized handlers
  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>, fallbackIndex: number) => {
    const target = e.target as HTMLImageElement
    const fallbackName = profile?.first_name || 'User'
    target.src = generateFallbackAvatar(fallbackName, fallbackIndex)
  }, [profile?.first_name])

  const handleAvatarChange = useCallback(async (avatarPath: string) => {
    if (!profile) {
      console.warn('Cannot update avatar: profile not loaded')
      return
    }

    try {
      setLoading(prev => ({ ...prev, avatarUpdate: true }))

      // Optimistic update for better UX
      const updatedProfile = { ...profile, avatar: avatarPath }
      setProfile(updatedProfile)
      setShowAvatarSelection(false)

      // Persist to database (gracefully handle missing table)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        throw new Error('User session not found')
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar: avatarPath })
        .eq('id', session.user.id)

      if (error) {
        // If table doesn't exist, just keep the optimistic update
        if (error.message.includes('table') && (error.message.includes('not found') || error.message.includes('schema cache'))) {
          console.warn('Profiles table not found. Avatar change saved locally only.')
          return
        }
        // Revert optimistic update on other errors
        setProfile(profile)
        throw error
      }
    } catch (err) {
      console.error('Failed to update avatar:', err)
      setError('Failed to update avatar. Please try again.')
      // Auto-clear error after 5 seconds
      setTimeout(() => setError(null), 5000)
    } finally {
      setLoading(prev => ({ ...prev, avatarUpdate: false }))
    }
  }, [profile])

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, profile: true }))
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        navigate('/auth')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('first_name, last_name, email, id_number, age, avatar')
        .eq('id', session.user.id)
        .single()

      if (error) {
        // Handle table not found error gracefully
        if (error.message.includes('table') && (error.message.includes('not found') || error.message.includes('schema cache'))) {
          console.warn('Profiles table not found. Using fallback profile data.')
          const fallbackProfile: UserProfile = {
            first_name: session.user.user_metadata?.first_name || 'Demo',
            last_name: session.user.user_metadata?.last_name || 'User', 
            email: session.user.email || 'demo@example.com',
            id_number: '12345678',
            age: 25,
            avatar: AVATAR_PATHS[0]
          }
          setProfile(fallbackProfile)
          return
        }
        throw new Error(`Failed to fetch profile: ${error.message}`)
      }

      // Set default avatar if none exists
      const profileData = data || {}
      if (!profileData.avatar) {
        profileData.avatar = AVATAR_PATHS[0]
      }

      setProfile(profileData as UserProfile)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
      console.error('Profile fetch error:', err)
      setError(errorMessage)
    } finally {
      setLoading(prev => ({ ...prev, profile: false }))
    }
  }, [navigate])

  const fetchScans = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, scans: true }))
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('scan_history')
        .select('id, scan_date, posture_type, score, success')
        .eq('user_id', session.user.id)
        .order('scan_date', { ascending: false })
        .limit(10)

      if (error) {
        throw new Error(`Failed to fetch scans: ${error.message}`)
      }

      // Type for database row structure
      interface ScanRow {
        id: string
        scan_date?: string
        posture_type?: string
        score?: number
        success?: boolean
      }

      const parsedScans: Scan[] = (data || []).map((row: ScanRow) => ({
        id: row.id,
        postureType: row.posture_type 
          ? row.posture_type.charAt(0).toUpperCase() + row.posture_type.slice(1)
          : 'Unknown',
        score: row.score ?? 0,
        success: Boolean(row.success),
        date: row.scan_date 
          ? new Date(row.scan_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'Unknown'
      }))

      setScans(parsedScans)
    } catch (err) {
      console.error('Scans fetch error:', err)
      // Don't show error for scans failure as it's not critical
      setScans([])
    } finally {
      setLoading(prev => ({ ...prev, scans: false }))
    }
  }, [])

  // Initial data loading
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchUserProfile(), fetchScans()])
    }
    loadData()
  }, [fetchUserProfile, fetchScans])

  const handleRetry = useCallback(() => {
    setError(null)
    fetchUserProfile()
    fetchScans()
  }, [fetchUserProfile, fetchScans])

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
          <p className="text-white text-xl font-bold">Loading your profile...</p>
          <p className="text-gray-400 text-sm mt-2">Please wait while we prepare your dashboard</p>
        </div>
      </div>
    )
  }

  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-6">
      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          <div className="flex items-center space-x-2">
            <span className="text-lg">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 p-6 sm:p-8 rounded-xl shadow-lg mb-6">
        <h1 className="text-white text-3xl sm:text-4xl font-extrabold">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ''}!
        </h1>
        <p className="text-emerald-200 text-base sm:text-lg mt-2">
          "Your journey to excellence starts here."
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Section */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-600">
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
            <div className="relative flex-shrink-0">
              <img
                src={profile?.avatar || AVATAR_PATHS[0]}
                alt={`${fullName}'s avatar`}
                className="w-24 h-24 rounded-full border-4 border-emerald-500 shadow-lg object-cover"
                onError={(e) => handleImageError(e, 0)}
                loading="lazy"
              />
              <button
                onClick={() => setShowAvatarSelection(!showAvatarSelection)}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center border-2 border-white shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-gray-800"
                title="Change Avatar"
                aria-label="Change avatar"
                disabled={loading.avatarUpdate}
              >
                {loading.avatarUpdate ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span className="text-white text-sm">✏️</span>
                )}
              </button>
            </div>
            
            <div className="text-center sm:text-left flex-grow">
              <h2 className="text-white text-2xl sm:text-3xl font-bold">
                {fullName || 'User Profile'}
              </h2>
              <p className="text-gray-400 text-base sm:text-lg">{profile?.email}</p>
              {process.env.NODE_ENV === 'development' && (
                <p className="text-gray-500 text-xs mt-1">
                  Avatar: {profile?.avatar?.split('/').pop() || 'None'}
                </p>
              )}
            </div>
          </div>

          {/* Profile Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <div className="bg-gray-900 p-4 sm:p-6 rounded-lg shadow-md border border-gray-700">
              <p className="text-gray-400 text-sm font-semibold mb-2">ID Number</p>
              <p className="text-white text-base sm:text-lg font-medium">
                {profile?.id_number || 'Not provided'}
              </p>
            </div>
            <div className="bg-gray-900 p-4 sm:p-6 rounded-lg shadow-md border border-gray-700">
              <p className="text-gray-400 text-sm font-semibold mb-2">Age</p>
              <p className="text-white text-base sm:text-lg font-medium">
                {profile?.age || 'Not provided'}
              </p>
            </div>
          </div>

          {/* Avatar Selection Modal */}
          {showAvatarSelection && (
            <div className="mt-6 p-4 sm:p-6 bg-gray-900/50 rounded-xl border border-emerald-500/30 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg sm:text-xl font-bold">Choose Your Avatar</h3>
                <button
                  onClick={() => setShowAvatarSelection(false)}
                  className="text-gray-400 hover:text-white text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded"
                  title="Close avatar selection"
                  aria-label="Close avatar selection"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 justify-center max-w-md mx-auto">
                {AVATAR_PATHS.map((avatarPath, index) => {
                  const isSelected = profile?.avatar === avatarPath
                  return (
                    <div key={`avatar-${index}`} className="relative">
                      <button
                        onClick={() => handleAvatarChange(avatarPath)}
                        className={`w-16 h-16 rounded-full border-4 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                          isSelected 
                            ? 'border-emerald-500 ring-2 ring-emerald-300' 
                            : 'border-gray-700 hover:border-emerald-400'
                        }`}
                        disabled={loading.avatarUpdate}
                        aria-label={`Select avatar ${index + 1}`}
                      >
                        <img
                          src={avatarPath}
                          alt={`Avatar option ${index + 1}`}
                          className="w-full h-full rounded-full object-cover"
                          onError={(e) => handleImageError(e, index)}
                          loading="lazy"
                        />
                      </button>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center pointer-events-none">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              <p className="text-center text-gray-400 text-sm mt-4">
                Click on an avatar to select it
              </p>
            </div>
          )}
        </div>

        {/* Recent Scans Section */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-700 p-6 sm:p-8 rounded-xl shadow-2xl border border-gray-600">
          <h2 className="text-white text-xl font-bold mb-4">Recent Scans</h2>
          {loading.scans ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
              <span className="text-gray-400 ml-3">Loading scans...</span>
            </div>
          ) : (
            <Suspense 
              fallback={
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                  <span className="text-gray-400 ml-3">Loading component...</span>
                </div>
              }
            >
              <RecentScans scans={scans} />
            </Suspense>
          )}
        </div>

        {/* Footer Section */}
        <footer className="text-center text-gray-400 text-sm mt-12 pb-6">
          <p>&copy; 2025 AlignMate. All rights reserved.</p>
          <nav className="flex justify-center space-x-6 mt-3" role="navigation" aria-label="Footer navigation">
            <a 
              href="/settings" 
              className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1"
              aria-label="Go to settings"
            >
              Settings
            </a>
            <a 
              href="/help" 
              className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1"
              aria-label="Get help"
            >
              Help
            </a>
            <button
              onClick={() => navigate('/auth')}
              className="hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded px-2 py-1"
              aria-label="Sign out"
            >
              Logout
            </button>
          </nav>
        </footer>
      </div>
    </div>
  )
}

export default Home