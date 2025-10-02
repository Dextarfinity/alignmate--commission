import { useState, useEffect } from "react"
import { useNavigate } from 'react-router'
import supabase from '../supabase'

interface UserProfile {
  id: number
  first_name: string
  last_name: string
  age: number
  ID_Number: string
  auth_users_id: string
  created_at?: string
  profile_image_url?: string | null
}

export const Settings = () => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [userEmail, setUserEmail] = useState<string>("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Load user profile on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) {
          navigate('/auth')
          return
        }

        setUserEmail(session.user.email ?? "")
        // Get avatar_url from user metadata (Google profile image if available)
        setAvatarUrl(session.user.user_metadata?.avatar_url ?? null)

        // Fetch profile from Additional_Information using auth.users.id
        const { data: profileData, error: profileError } = await supabase
          .from('Additional_Information')
          .select('*')
          .eq('auth_users_id', session.user.id)
          .single()

        if (profileError) {
          console.error('Error loading profile:', profileError)
        } else if (profileData) {
          setProfile(profileData)
          setEditForm(profileData)
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [navigate])

  const handleSave = async () => {
    if (!profile || !editForm.first_name || !editForm.last_name) return

    try {
      setSaving(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Update profile in Additional_Information
      const { error } = await supabase
        .from('Additional_Information')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          age: editForm.age,
          ID_Number: editForm.ID_Number,
          profile_image_url: avatarUrl, // Always use Google avatar
        })
        .eq('auth_users_id', session.user.id)

      if (error) {
        console.error('Error updating profile:', error)
        alert('Failed to save profile changes')
        return
      }

      const updatedProfile = { ...profile, ...editForm, profile_image_url: avatarUrl }
      setProfile(updatedProfile)
      setIsEditing(false)
      alert('Profile updated successfully!')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('Failed to save profile changes')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  // Bind/Connect with Google
  const handleBindGoogle = async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/settings`
        }
      })
      if (error) {
        alert('Failed to bind Google account')
      }
    } catch (error) {
      alert('Failed to bind Google account')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your profile...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white text-xl mb-4">Unable to load profile</p>
          <button 
            onClick={() => navigate('/auth')}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-400 hover:to-purple-500 transition-all duration-300"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
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
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xl font-bold">⚙️</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Profile Settings</h1>
              <p className="text-blue-100 text-sm mt-1">Manage your account and preferences</p>
            </div>
          </div>
          
          {/* Quick Sign Out Button */}
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
        {/* Profile Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-white text-lg">👤</span>
              </div>
              <h2 className="text-white text-xl font-bold">Profile Information</h2>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-400 hover:to-purple-500 transition-all duration-300 font-semibold shadow-lg"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setEditForm(profile || {})
                  }}
                  className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 border border-white/20"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-400 hover:to-green-500 transition-all duration-300 disabled:opacity-50 font-semibold"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Profile Image (Google only, no upload/edit) */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1">
                <div className="w-full h-full rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
                  {avatarUrl
                    ? (
                      <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    )
                    : (
                      <span className="text-white text-2xl">👤</span>
                    )
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Bind/Connect with Google Button */}
          <div className="flex justify-center mb-8">
            <button
              type="button"
              onClick={handleBindGoogle}
              className="flex items-center gap-2 bg-white text-blue-700 font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-blue-50 transition-all duration-300"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" className="w-6 h-6" />
              Bind with Google
            </button>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">First Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.first_name || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter first name"
                />
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.first_name}</div>
              )}
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">Last Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.last_name || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter last name"
                />
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.last_name}</div>
              )}
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">Email</label>
              <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{userEmail}</div>
              <p className="text-blue-300 text-xs mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">Age</label>
              {isEditing ? (
                <input
                  type="number"
                  value={editForm.age || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, age: Number(e.target.value) }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter your age"
                />
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.age}</div>
              )}
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">ID Number</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.ID_Number || ""}
                  onChange={(e) => setEditForm(prev => ({ ...prev, ID_Number: e.target.value }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter your ID number"
                />
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.ID_Number}</div>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <button 
            onClick={handleSignOut}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-semibold hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-lg"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>Sign Out</span>
              <span>🚪</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Settings