import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import supabase from '../supabase'

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  id_number?: string | null
  age?: number | null
  avatar?: string
  created_at?: string
}

interface UserStats {
  total_scans: number
  avg_score: number
  best_score: number
  success_rate: number
  successful_scans: number
  streak_days: number
}

interface Scan {
  id: string
  posture_type: string
  score: number
  success: boolean
  feedback: string
  scan_date: string
  created_at: string
}

interface UseUserDataReturn {
  profile: UserProfile | null
  stats: UserStats
  recentScans: Scan[]
  loading: {
    profile: boolean
    stats: boolean
    scans: boolean
  }
  error: string | null
  refreshProfile: () => Promise<void>
  refreshStats: () => Promise<void>
  refreshScans: () => Promise<void>
  refreshAll: () => Promise<void>
}

export const useUserData = (): UseUserDataReturn => {
  const navigate = useNavigate()
  
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats>({
    total_scans: 0,
    avg_score: 0,
    best_score: 0,
    success_rate: 0,
    successful_scans: 0,
    streak_days: 0
  })
  const [recentScans, setRecentScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState({
    profile: true,
    stats: true,
    scans: true
  })
  const [error, setError] = useState<string | null>(null)

  // Fetch user profile
  const refreshProfile = useCallback(async () => {
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
        .select(`
          id,
          email,
          first_name,
          last_name,
          id_number,
          age,
          avatar,
          created_at
        `)
        .eq('id', session.user.id)
        .single()

      if (error) {
        // Handle specific PostgreSQL "not found" error
        if (error.code === 'PGRST116') {
          console.warn('FIXED: Profile not found, but NOT redirecting to auth')
          setError('Profile not found')
          setLoading(prev => ({ ...prev, profile: false }))
          return
        }
        
        // Handle HTTP 406 Not Acceptable error (likely schema mismatch)
        if (error.message?.includes('406') || error.details?.includes('406')) {
          console.error('FIXED: Schema mismatch error (406) - NOT redirecting:', error)
          setError('Database schema mismatch. Please update the database schema.')
          setLoading(prev => ({ ...prev, profile: false }))
          return
        }
        
        // Don't redirect on other errors, just log and continue
        console.error('FIXED: Profile fetch error - NOT redirecting:', error)
        setError(`Failed to load profile: ${error.message}`)
        setLoading(prev => ({ ...prev, profile: false }))
        return
      }

      setProfile(data as UserProfile)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
      console.error('Profile fetch error:', err)
      setError(errorMessage)
    } finally {
      setLoading(prev => ({ ...prev, profile: false }))
    }
  }, [navigate])

  // Fetch user statistics
  const refreshStats = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, stats: true }))
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data: scanData, error } = await supabase
        .from('scan_history')
        .select('score, success, created_at')
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Stats fetch error:', error)
        return
      }

      if (scanData && scanData.length > 0) {
        const totalScans = scanData.length
        const successfulScans = scanData.filter(scan => scan.success).length
        const avgScore = Math.round(scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans)
        const bestScore = Math.max(...scanData.map(scan => scan.score))
        const successRate = Math.round((successfulScans / totalScans) * 100)
        
        // Calculate streak (simplified - last 7 days with scans)
        const recentDays = 7
        const now = new Date()
        const daysWithScans = new Set()
        
        scanData.forEach(scan => {
          const scanDate = new Date(scan.created_at)
          const daysDiff = Math.floor((now.getTime() - scanDate.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff < recentDays) {
            daysWithScans.add(daysDiff)
          }
        })
        
        setStats({
          total_scans: totalScans,
          avg_score: avgScore,
          best_score: bestScore,
          success_rate: successRate,
          successful_scans: successfulScans,
          streak_days: daysWithScans.size
        })
      } else {
        setStats({
          total_scans: 0,
          avg_score: 0,
          best_score: 0,
          success_rate: 0,
          successful_scans: 0,
          streak_days: 0
        })
      }
    } catch (err) {
      console.error('Stats calculation error:', err)
    } finally {
      setLoading(prev => ({ ...prev, stats: false }))
    }
  }, [])

  // Fetch recent scans
  const refreshScans = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, scans: true }))
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      const { data, error } = await supabase
        .from('scan_history')
        .select(`
          id,
          posture_type,
          score,
          success,
          feedback,
          scan_date,
          created_at
        `)
        .eq('user_id', session.user.id)
        .order('scan_date', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Scans fetch error:', error)
        return
      }

      setRecentScans(data || [])
    } catch (err) {
      console.error('Recent scans fetch error:', err)
    } finally {
      setLoading(prev => ({ ...prev, scans: false }))
    }
  }, [])

  // Refresh all data
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshProfile(),
      refreshStats(),
      refreshScans()
    ])
  }, [refreshProfile, refreshStats, refreshScans])

  // Initial data load
  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  return {
    profile,
    stats,
    recentScans,
    loading,
    error,
    refreshProfile,
    refreshStats,
    refreshScans,
    refreshAll
  }
}