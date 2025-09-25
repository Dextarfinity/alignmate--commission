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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900">
      {/* Military Camo Pattern Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,_rgba(34,197,94,0.1)_0deg,_rgba(22,163,74,0.1)_90deg,_rgba(34,197,94,0.1)_180deg,_rgba(21,128,61,0.1)_270deg)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,_rgba(34,197,94,0.05),_transparent_50%)]"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_25%,_rgba(22,163,74,0.05),_transparent_50%)]"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_75%,_rgba(21,128,61,0.05),_transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_75%,_rgba(16,185,129,0.05),_transparent_50%)]"></div>
      </div>

      {/* Floating Military Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-6xl text-emerald-500/10 animate-pulse">🎖️</div>
        <div className="absolute top-40 right-20 text-4xl text-green-400/10 animate-bounce delay-1000">⭐</div>
        <div className="absolute bottom-40 left-20 text-5xl text-emerald-600/10 animate-pulse delay-2000">🏆</div>
        <div className="absolute bottom-20 right-10 text-3xl text-green-500/10 animate-bounce delay-500">🎯</div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-emerald-900/80 to-green-800/80 backdrop-blur-xl border-b border-emerald-500/30 shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50">
                  <span className="text-white text-2xl font-bold animate-pulse">🎖️</span>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xs">⭐</span>
                </div>
              </div>
              <div>
                <h1 className="text-white text-3xl font-bold tracking-tight mb-1">
                  <span className="bg-gradient-to-r from-emerald-300 to-green-400 bg-clip-text text-transparent">
                    MILITARY COMMAND CENTER
                  </span>
                </h1>
                <div className="flex items-center space-x-3">
                  <p className="text-emerald-100 text-sm font-medium">
                    {userProfile ? `🫡 Welcome back, ${userProfile.first_name}!` : 'Your elite posture training headquarters'}
                  </p>
                  <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                    <span className="text-emerald-300 text-xs font-bold">ACTIVE DUTY</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Enhanced Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="group bg-gradient-to-r from-red-600/80 to-red-700/80 hover:from-red-500 hover:to-red-600 text-white border border-red-400/30 hover:border-red-300/50 px-6 py-3 rounded-xl font-bold transition-all duration-300 backdrop-blur-sm flex items-center space-x-3 shadow-lg shadow-red-500/25 hover:shadow-red-400/40"
            >
              <span className="group-hover:animate-pulse">🚪</span>
              <span>SIGN OUT</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative p-6 space-y-8">
        {/* Enhanced Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="group bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/30 hover:border-emerald-300/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-2xl">📊</span>
              </div>
              <div className="text-4xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors duration-300">{totalScans}</div>
              <div className="text-emerald-200 text-sm font-bold uppercase tracking-wider">Total Missions</div>
              <div className="mt-2 h-1 bg-emerald-600/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000"></div>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/30 hover:border-emerald-300/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-green-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/40 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-2xl">🎯</span>
              </div>
              <div className="text-4xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors duration-300">{averageScore}%</div>
              <div className="text-emerald-200 text-sm font-bold uppercase tracking-wider">Combat Efficiency</div>
              <div className="mt-2 h-1 bg-emerald-600/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 delay-200"></div>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/30 hover:border-emerald-300/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-yellow-500 to-orange-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/30 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-2xl">⚡</span>
              </div>
              <div className="text-4xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors duration-300">{successRate}%</div>
              <div className="text-emerald-200 text-sm font-bold uppercase tracking-wider">Victory Rate</div>
              <div className="mt-2 h-1 bg-emerald-600/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 delay-400"></div>
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-6 border border-emerald-400/30 hover:border-emerald-300/50 transition-all duration-500 hover:scale-105 hover:shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative text-center">
              <div className="w-14 h-14 bg-gradient-to-r from-red-500 to-pink-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-500/30 group-hover:scale-110 transition-transform duration-300">
                <span className="text-white text-2xl">✅</span>
              </div>
              <div className="text-4xl font-black text-white mb-2 group-hover:text-emerald-300 transition-colors duration-300">{successfulScans}</div>
              <div className="text-emerald-200 text-sm font-bold uppercase tracking-wider">Successful Ops</div>
              <div className="mt-2 h-1 bg-emerald-600/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-400 to-pink-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 delay-600"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Military Weekly Progress Chart */}
        <div className="bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-8 border border-emerald-400/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400/10 to-transparent rounded-full transform translate-x-16 -translate-y-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-400 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <span className="text-white text-xl">📈</span>
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">WEEKLY OPERATIONS REPORT</h2>
                  <p className="text-emerald-200 text-sm font-medium">Performance analysis & tactical review</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-lg">
                <span className="text-emerald-300 text-sm font-bold">CLASSIFIED</span>
              </div>
            </div>
            {weeklyProgress.length > 0 ? (
              <div className="space-y-6">
                {weeklyProgress.map((week, index) => (
                  <div key={index} className="bg-gradient-to-r from-emerald-900/40 to-green-800/40 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 group">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-r from-emerald-600 to-green-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-emerald-100 font-bold text-lg">{week.week}</div>
                          <div className="text-emerald-300 text-sm font-medium">{week.scans} tactical operations</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-white text-xl font-black">{week.avgScore}%</div>
                        <div className="text-emerald-200 text-xs font-medium uppercase">Efficiency</div>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1 bg-slate-800/60 rounded-full h-4 overflow-hidden border border-emerald-600/30">
                          <div
                            className="bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 h-4 rounded-full transition-all duration-1000 ease-out shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-400/50"
                            style={{ width: `${week.avgScore}%` }}
                          ></div>
                        </div>
                        <div className="px-3 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-full">
                          <span className="text-emerald-300 text-xs font-bold">
                            {week.avgScore >= 90 ? 'EXCELLENT' : week.avgScore >= 70 ? 'GOOD' : week.avgScore >= 50 ? 'FAIR' : 'NEEDS IMPROVEMENT'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                  <span className="text-3xl">📊</span>
                </div>
                <p className="text-emerald-200 text-xl font-bold mb-2">NO OPERATION DATA AVAILABLE</p>
                <p className="text-emerald-300 text-sm">Initiate first mission to populate intelligence report</p>
                <button 
                  onClick={() => navigate('/camera')}
                  className="mt-4 px-6 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold hover:from-emerald-500 hover:to-green-500 transition-all duration-300 shadow-lg shadow-emerald-500/30"
                >
                  START FIRST MISSION
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Military Recent Operations */}
        <div className="bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-8 border border-emerald-400/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-40 h-40 bg-gradient-to-br from-emerald-400/5 to-transparent rounded-full transform -translate-x-20 -translate-y-20"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-400 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/30">
                  <span className="text-white text-xl">🎯</span>
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">RECENT TACTICAL OPERATIONS</h2>
                  <p className="text-emerald-200 text-sm font-medium">Latest mission status & combat readiness</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-300 text-sm font-bold">LIVE STATUS</span>
              </div>
            </div>
            {recentScans.length > 0 ? (
              <div className="space-y-4">
                {recentScans.map((scan, index) => (
                  <div key={scan.id} className="group bg-gradient-to-r from-emerald-900/40 to-green-800/40 backdrop-blur-sm rounded-xl p-6 border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl shadow-emerald-500/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="relative">
                          <div className={`w-16 h-16 ${postureTypes[scan.postureType as keyof typeof postureTypes]?.color || 'bg-gray-500'} rounded-xl flex items-center justify-center shadow-lg border border-white/20 group-hover:scale-110 transition-transform duration-300`}>
                            <span className="text-white text-2xl">{postureTypes[scan.postureType as keyof typeof postureTypes]?.icon || '📋'}</span>
                          </div>
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-emerald-800">
                            <span className="text-xs font-bold">{index + 1}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="text-white font-bold text-xl">{scan.postureType.toUpperCase()}</div>
                            <div className="px-3 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-full">
                              <span className="text-emerald-300 text-xs font-bold">OPERATION</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-emerald-200 text-sm font-medium">
                              📅 {new Date(scan.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <div className="text-emerald-300 text-sm font-medium">
                              ⏰ Mission #{scan.id.slice(-4).toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-black mb-2 ${scan.success ? 'text-emerald-400' : 'text-red-400'} group-hover:scale-110 transition-transform duration-300`}>
                          {scan.score}%
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all duration-300 ${
                          scan.success 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 group-hover:bg-emerald-500/30' 
                            : 'bg-red-500/20 text-red-300 border-red-500/40 group-hover:bg-red-500/30'
                        }`}>
                          {scan.success ? '✅ MISSION SUCCESS' : '❌ MISSION FAILED'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                  <span className="text-3xl">🎯</span>
                </div>
                <p className="text-emerald-200 text-xl font-bold mb-2">NO MISSION HISTORY</p>
                <p className="text-emerald-300 text-sm mb-6">Deploy first tactical operation to begin combat log</p>
                <button 
                  onClick={() => navigate('/camera')}
                  className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-xl font-bold hover:from-emerald-500 hover:to-green-500 transition-all duration-300 shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/50 transform hover:scale-105"
                >
                  🚀 INITIATE FIRST OPERATION
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Military Command Center - Quick Actions */}
        <div className="bg-gradient-to-br from-emerald-800/60 to-green-700/60 backdrop-blur-xl rounded-2xl p-8 border border-emerald-400/30 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/10 to-transparent rounded-full transform translate-x-16 -translate-y-16"></div>
          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-400 rounded-xl flex items-center justify-center shadow-lg shadow-yellow-500/30">
                  <span className="text-white text-xl">⚡</span>
                </div>
                <div>
                  <h2 className="text-white text-2xl font-bold">COMMAND & CONTROL</h2>
                  <p className="text-emerald-200 text-sm font-medium">Tactical operations dashboard</p>
                </div>
              </div>
              <div className="px-4 py-2 bg-yellow-500/20 border border-yellow-400/30 rounded-lg">
                <span className="text-yellow-300 text-sm font-bold">PRIORITY ACCESS</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <button 
                onClick={() => navigate('/camera')}
                className="group relative bg-gradient-to-br from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white p-8 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-2xl shadow-emerald-500/30 border border-emerald-500/30 hover:border-emerald-400/50 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="text-5xl mb-4 group-hover:scale-125 transition-transform duration-500 filter drop-shadow-lg">📷</div>
                  <div className="text-xl font-black mb-2">DEPLOY SCANNER</div>
                  <div className="text-emerald-200 text-sm font-medium">Initiate posture analysis mission</div>
                  <div className="mt-4 w-full h-1 bg-emerald-600/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000"></div>
                  </div>
                </div>
              </button>

              <button className="group relative bg-gradient-to-br from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white p-8 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-2xl shadow-blue-500/30 border border-blue-500/30 hover:border-blue-400/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="text-5xl mb-4 group-hover:scale-125 transition-transform duration-500 filter drop-shadow-lg">📊</div>
                  <div className="text-xl font-black mb-2">INTEL REPORT</div>
                  <div className="text-blue-200 text-sm font-medium">Complete mission history</div>
                  <div className="mt-4 w-full h-1 bg-blue-600/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000"></div>
                  </div>
                </div>
              </button>

              <button className="group relative bg-gradient-to-br from-purple-700 to-pink-700 hover:from-purple-600 hover:to-pink-600 text-white p-8 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-2xl shadow-purple-500/30 border border-purple-500/30 hover:border-purple-400/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="text-5xl mb-4 group-hover:scale-125 transition-transform duration-500 filter drop-shadow-lg">🎯</div>
                  <div className="text-xl font-black mb-2">SET OBJECTIVES</div>
                  <div className="text-purple-200 text-sm font-medium">Define tactical targets</div>
                  <div className="mt-4 w-full h-1 bg-purple-600/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-purple-400 to-pink-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000"></div>
                  </div>
                </div>
              </button>

              <button className="group relative bg-gradient-to-br from-orange-700 to-red-700 hover:from-orange-600 hover:to-red-600 text-white p-8 rounded-2xl font-bold transition-all duration-500 transform hover:scale-105 hover:shadow-2xl shadow-orange-500/30 border border-orange-500/30 hover:border-orange-400/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative text-center">
                  <div className="text-5xl mb-4 group-hover:scale-125 transition-transform duration-500 filter drop-shadow-lg">📚</div>
                  <div className="text-xl font-black mb-2">TRAINING MANUAL</div>
                  <div className="text-orange-200 text-sm font-medium">Combat techniques guide</div>
                  <div className="mt-4 w-full h-1 bg-orange-600/30 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-1000"></div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Military Achievement Badge */}
        {totalScans >= 5 && (
          <div className="relative bg-gradient-to-br from-yellow-600 via-orange-600 to-red-600 rounded-2xl p-10 text-center overflow-hidden border-4 border-yellow-400/50 shadow-2xl shadow-yellow-500/30">
            {/* Military decorative elements */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,_rgba(255,215,0,0.1)_0deg,_rgba(255,140,0,0.1)_90deg,_rgba(255,69,0,0.1)_180deg,_rgba(255,215,0,0.1)_270deg)]"></div>
            <div className="absolute top-4 left-4 text-3xl text-yellow-200/30 animate-pulse">⭐</div>
            <div className="absolute top-4 right-4 text-3xl text-yellow-200/30 animate-pulse delay-500">⭐</div>
            <div className="absolute bottom-4 left-4 text-2xl text-orange-200/30 animate-pulse delay-1000">🎖️</div>
            <div className="absolute bottom-4 right-4 text-2xl text-orange-200/30 animate-pulse delay-1500">🎖️</div>
            
            <div className="relative z-10">
              <div className="relative inline-block mb-6">
                <div className="text-8xl animate-bounce">🏆</div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center border-2 border-yellow-300">
                  <span className="text-sm font-bold">★</span>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-white text-4xl font-black mb-3 drop-shadow-lg">
                  🎖️ DISTINGUISHED SERVICE MEDAL 🎖️
                </h3>
                <div className="w-32 h-1 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 mx-auto rounded-full mb-4"></div>
                <p className="text-yellow-100 text-xl font-bold mb-2">
                  EXCEPTIONAL MILITARY PERFORMANCE
                </p>
                <p className="text-yellow-200 text-lg mb-2">
                  🏅 {totalScans} Successful Operations Completed
                </p>
                <p className="text-orange-200 text-base font-medium">
                  Combat Efficiency Rating: {averageScore}% - OUTSTANDING
                </p>
              </div>
              
              <div className="flex justify-center space-x-6 mb-6">
                <div className="bg-yellow-500/20 border border-yellow-400/40 rounded-xl px-6 py-3 backdrop-blur-sm">
                  <div className="text-yellow-300 text-2xl font-black">{successfulScans}</div>
                  <div className="text-yellow-200 text-sm font-bold">VICTORIES</div>
                </div>
                <div className="bg-orange-500/20 border border-orange-400/40 rounded-xl px-6 py-3 backdrop-blur-sm">
                  <div className="text-orange-300 text-2xl font-black">{successRate}%</div>
                  <div className="text-orange-200 text-sm font-bold">SUCCESS</div>
                </div>
              </div>
              
              <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 rounded-full px-8 py-4 border border-yellow-400/50 backdrop-blur-sm">
                <span className="text-yellow-200 text-lg font-black">CONTINUE EXCELLENCE</span>
                <span className="text-yellow-300 text-2xl animate-pulse">⭐</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home