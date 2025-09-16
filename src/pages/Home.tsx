import { useState, useEffect } from "react"
import { useNavigate } from 'react-router'
import supabase from '../supabase'

interface ScanHistory {
  id: string
  date: string
  postureType: string
  score: number
  success: boolean
}

interface WeeklyProgress {
  week: string
  scans: number
  avgScore: number
}

export const Home = () => {
  const navigate = useNavigate()
  const [scanHistory, setScanHistory] = useState<ScanHistory[]>([])
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<{ first_name: string; last_name: string } | null>(null)

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)
        
        // Check if user is authenticated
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          navigate('/auth')
          return
        }

        // Load user profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single()

        if (profileData) {
          setUserProfile(profileData)
        }

        // Load scan history (last 10 scans)
        const { data: scanData } = await supabase
          .from('scan_history')
          .select('*')
          .eq('user_id', session.user.id)
          .order('scan_date', { ascending: false })
          .limit(10)

        if (scanData) {
          setScanHistory(scanData.map((scan: { id: string; scan_date: string; posture_type: string; score: number; success: boolean }) => ({
            id: scan.id,
            date: scan.scan_date.split('T')[0],
            postureType: scan.posture_type.charAt(0).toUpperCase() + scan.posture_type.slice(1),
            score: scan.score,
            success: scan.success
          })))
        }

        // Load weekly progress (last 4 weeks)
        const { data: weeklyData } = await supabase
          .from('weekly_progress')
          .select('*')
          .eq('user_id', session.user.id)
          .order('week_start_date', { ascending: false })
          .limit(4)

        if (weeklyData) {
          setWeeklyProgress(weeklyData.map((week: { total_scans: number; average_score: number }, index: number) => ({
            week: `Week ${index + 1}`,
            scans: week.total_scans,
            avgScore: Math.round(week.average_score)
          })).reverse())
        }

      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [navigate])

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-600 to-green-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // Calculate statistics
  const totalScans = scanHistory.length
  const successfulScans = scanHistory.filter(scan => scan.success).length
  const averageScore = totalScans > 0 ? Math.round(scanHistory.reduce((sum, scan) => sum + scan.score, 0) / totalScans) : 0
  const successRate = totalScans > 0 ? Math.round((successfulScans / totalScans) * 100) : 0
  const recentScans = scanHistory.slice(0, 3)

  const postureTypes = {
    'Salutation': { color: 'bg-blue-500', icon: '🫡' },
    'Attention': { color: 'bg-green-500', icon: '🎖️' },
    'Marching': { color: 'bg-orange-500', icon: '🚶' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(59,130,246,0.1),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(139,92,246,0.1),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(34,197,94,0.1),_transparent_50%)]"></div>
      </div>

      {/* Header */}
      <div className="relative bg-white/10 backdrop-blur-lg border-b border-white/20 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">🎖️</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Mission Control</h1>
              <p className="text-blue-100 text-sm mt-1">
                {userProfile ? `Welcome back, ${userProfile.first_name}!` : 'Your posture training command center'}
              </p>
            </div>
          </div>
          
          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/30 px-4 py-2 rounded-xl font-semibold transition-all duration-300 backdrop-blur-sm flex items-center space-x-2"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="relative p-6 space-y-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-xl">📊</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{totalScans}</div>
              <div className="text-blue-200 text-sm font-medium">Total Scans</div>
            </div>
          </div>
          <div className="group bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-xl">🎯</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{averageScore}%</div>
              <div className="text-emerald-200 text-sm font-medium">Avg Score</div>
            </div>
          </div>
          <div className="group bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-xl">⚡</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{successRate}%</div>
              <div className="text-purple-200 text-sm font-medium">Success Rate</div>
            </div>
          </div>
          <div className="group bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:scale-105">
            <div className="text-center">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-white text-xl">✅</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{successfulScans}</div>
              <div className="text-orange-200 text-sm font-medium">Passed Scans</div>
            </div>
          </div>
        </div>

        {/* Weekly Progress Chart */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">📈</span>
            </div>
            <h2 className="text-white text-xl font-bold">Weekly Progress</h2>
          </div>
          {weeklyProgress.length > 0 ? (
            <div className="space-y-4">
              {weeklyProgress.map((week, index) => (
                <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-blue-100 font-medium">{week.week}</div>
                    <div className="text-white text-sm font-semibold">{week.scans} scans</div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 bg-slate-700/50 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${week.avgScore}%` }}
                      ></div>
                    </div>
                    <div className="text-white font-bold text-lg min-w-[3rem] text-right">{week.avgScore}%</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <p className="text-blue-200 text-lg">No weekly progress data yet</p>
              <p className="text-blue-300 text-sm mt-1">Start scanning to see your progress!</p>
            </div>
          )}
        </div>

        {/* Recent Scans */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🎯</span>
            </div>
            <h2 className="text-white text-xl font-bold">Recent Scans</h2>
          </div>
          {recentScans.length > 0 ? (
            <div className="space-y-4">
              {recentScans.map((scan) => (
                <div key={scan.id} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 ${postureTypes[scan.postureType as keyof typeof postureTypes]?.color || 'bg-gray-500'} rounded-full flex items-center justify-center`}>
                        <span className="text-white text-xl">{postureTypes[scan.postureType as keyof typeof postureTypes]?.icon || '📋'}</span>
                      </div>
                      <div>
                        <div className="text-white font-semibold text-lg">{scan.postureType}</div>
                        <div className="text-blue-200 text-sm">{new Date(scan.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${scan.success ? 'text-emerald-400' : 'text-red-400'} mb-1`}>
                        {scan.score}%
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-semibold ${scan.success ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                        {scan.success ? 'PASSED' : 'FAILED'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <p className="text-blue-200 text-lg">No scan history yet</p>
              <p className="text-blue-300 text-sm mt-1">Start your first posture scan!</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">⚡</span>
            </div>
            <h2 className="text-white text-xl font-bold">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/camera')}
              className="group bg-gradient-to-r from-emerald-600 to-green-600 text-white p-6 rounded-xl font-semibold hover:from-emerald-500 hover:to-green-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-emerald-500/25"
            >
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">📷</div>
              <div className="text-lg">Start Scan</div>
              <div className="text-emerald-100 text-sm mt-1">Begin posture analysis</div>
            </button>
            <button className="group bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-xl font-semibold hover:from-blue-500 hover:to-indigo-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-blue-500/25">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">📊</div>
              <div className="text-lg">View History</div>
              <div className="text-blue-100 text-sm mt-1">See all scans</div>
            </button>
            <button className="group bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-xl font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-purple-500/25">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">🎯</div>
              <div className="text-lg">Set Goals</div>
              <div className="text-purple-100 text-sm mt-1">Define targets</div>
            </button>
            <button className="group bg-gradient-to-r from-orange-600 to-red-600 text-white p-6 rounded-xl font-semibold hover:from-orange-500 hover:to-red-500 transition-all duration-300 transform hover:scale-105 hover:shadow-xl shadow-orange-500/25">
              <div className="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300">📚</div>
              <div className="text-lg">Training Guide</div>
              <div className="text-orange-100 text-sm mt-1">Learn techniques</div>
            </button>
          </div>
        </div>

        {/* Achievement Badge */}
        {totalScans >= 5 && (
          <div className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-2xl p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.1),_transparent_70%)]"></div>
            <div className="relative">
              <div className="text-6xl mb-4 animate-bounce">🏆</div>
              <h3 className="text-white text-2xl font-bold mb-2">Outstanding Progress!</h3>
              <p className="text-yellow-100 text-lg mb-2">You've completed {totalScans} scans</p>
              <p className="text-yellow-200 text-sm">with an average score of {averageScore}%</p>
              <div className="mt-4 inline-flex items-center space-x-2 bg-white/20 rounded-full px-4 py-2">
                <span className="text-yellow-200 text-sm font-semibold">Keep up the excellent work!</span>
                <span className="text-yellow-300">⭐</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home