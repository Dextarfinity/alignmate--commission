import { useState, useEffect } from "react"
import { useNavigate } from 'react-router'
import supabase from '../supabase'

interface UserProfile {
  id: string
  first_name: string
  last_name: string
  email: string
  rank: string
  unit: string
  profile_image_url?: string | null
  created_at?: string
  updated_at?: string
}

interface UserSettings {
  notifications_enabled: boolean
  camera_auto_focus: boolean
  save_scan_history: boolean
}

export const Settings = () => {
  const navigate = useNavigate()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [settings, setSettings] = useState<UserSettings>({
    notifications_enabled: true,
    camera_auto_focus: true,
    save_scan_history: true
  })
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({})
  const [showImagePicker, setShowImagePicker] = useState(false)

  // Load user profile and settings on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true)
        
        // Get current user
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session?.user) {
          navigate('/auth')
          return
        }

        // Load profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('Error loading profile:', profileError)
        } else if (profileData) {
          setProfile(profileData)
          setEditForm(profileData)
        }

        // Load settings
        const { data: settingsData, error: settingsError } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', session.user.id)
          .single()

        if (settingsError) {
          console.error('Error loading settings:', settingsError)
        } else if (settingsData) {
          setSettings({
            notifications_enabled: settingsData.notifications_enabled,
            camera_auto_focus: settingsData.camera_auto_focus,
            save_scan_history: settingsData.save_scan_history
          })
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

      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          rank: editForm.rank,
          unit: editForm.unit,
          profile_image_url: editForm.profile_image_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', session.user.id)

      if (error) {
        console.error('Error updating profile:', error)
        alert('Failed to save profile changes')
        return
      }

      // Update local state
      const updatedProfile = { ...profile, ...editForm }
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

  const handleSettingsChange = async (key: keyof UserSettings, value: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return

      // Update settings in database
      const { error } = await supabase
        .from('user_settings')
        .update({ [key]: value })
        .eq('user_id', session.user.id)

      if (error) {
        console.error('Error updating settings:', error)
        return
      }

      // Update local state
      setSettings(prev => ({ ...prev, [key]: value }))
    } catch (error) {
      console.error('Error updating settings:', error)
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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setEditForm(prev => ({ ...prev, profile_image_url: reader.result as string }))
        setShowImagePicker(false)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setEditForm(prev => ({ ...prev, profile_image_url: null }))
    setShowImagePicker(false)
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

          {/* Profile Image */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 p-1">
                <div className="w-full h-full rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
                  {(isEditing ? editForm.profile_image_url : profile.profile_image_url) ? (
                    <img
                      src={isEditing ? editForm.profile_image_url! : profile.profile_image_url!}
                      alt="Profile"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-white text-2xl">👤</span>
                  )}
                </div>
              </div>
              {isEditing && (
                <button
                  onClick={() => setShowImagePicker(true)}
                  className="absolute -bottom-2 -right-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white p-2 rounded-full hover:from-blue-400 hover:to-purple-500 transition-all duration-300 shadow-lg"
                >
                  <span className="text-sm">📷</span>
                </button>
              )}
            </div>
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
              <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.email}</div>
              <p className="text-blue-300 text-xs mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-blue-200 text-sm font-semibold mb-2">Rank</label>
              {isEditing ? (
                <select
                  value={editForm.rank || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, rank: e.target.value }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                >
                  <option value="Cadet Private" className="bg-slate-800 text-white">Cadet Private</option>
                  <option value="Cadet Corporal" className="bg-slate-800 text-white">Cadet Corporal</option>
                  <option value="Cadet Sergeant" className="bg-slate-800 text-white">Cadet Sergeant</option>
                  <option value="Cadet Staff Sergeant" className="bg-slate-800 text-white">Cadet Staff Sergeant</option>
                  <option value="Cadet Master Sergeant" className="bg-slate-800 text-white">Cadet Master Sergeant</option>
                  <option value="Cadet Lieutenant" className="bg-slate-800 text-white">Cadet Lieutenant</option>
                  <option value="Cadet Captain" className="bg-slate-800 text-white">Cadet Captain</option>
                </select>
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.rank}</div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-blue-200 text-sm font-semibold mb-2">Unit</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.unit || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="Enter unit"
                />
              ) : (
                <div className="bg-white/5 p-4 rounded-xl text-white border border-white/10">{profile.unit}</div>
              )}
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-lg">🔧</span>
            </div>
            <h2 className="text-white text-xl font-bold">App Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <h3 className="text-white font-semibold">Push Notifications</h3>
                <p className="text-blue-200 text-sm">Receive notifications about your training progress</p>
              </div>
              <button
                onClick={() => handleSettingsChange('notifications_enabled', !settings.notifications_enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.notifications_enabled ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <h3 className="text-white font-semibold">Camera Auto Focus</h3>
                <p className="text-blue-200 text-sm">Automatically focus camera during scans</p>
              </div>
              <button
                onClick={() => handleSettingsChange('camera_auto_focus', !settings.camera_auto_focus)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.camera_auto_focus ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.camera_auto_focus ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
              <div>
                <h3 className="text-white font-semibold">Save Scan History</h3>
                <p className="text-blue-200 text-sm">Keep a record of all your posture scans</p>
              </div>
              <button
                onClick={() => handleSettingsChange('save_scan_history', !settings.save_scan_history)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.save_scan_history ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.save_scan_history ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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

      {/* Image Picker Modal */}
      {showImagePicker && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-sm border border-white/20">
            <h3 className="text-white text-xl font-bold mb-6">Update Profile Picture</h3>
            <div className="space-y-4">
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-center py-4 rounded-xl font-semibold hover:from-blue-400 hover:to-purple-500 transition-all duration-300 cursor-pointer">
                  Choose Photo
                </div>
              </label>
              {(editForm.profile_image_url || profile.profile_image_url) && (
                <button
                  onClick={handleRemoveImage}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 rounded-xl font-semibold hover:from-red-400 hover:to-red-500 transition-all duration-300"
                >
                  Remove Photo
                </button>
              )}
              <button
                onClick={() => setShowImagePicker(false)}
                className="w-full bg-white/10 text-white py-4 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings