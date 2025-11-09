import { useNavigate } from 'react-router';
import { useUserData } from '../hooks/useUserData';
import supabase from '../supabase';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import AudioControls from '../components/AudioControls';
import { useAudio } from '../contexts/AudioContext';

// Military-themed avatar options from public assets
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
] as const;

const STORAGE_KEY = 'alignmate_selected_avatar';

export const Settings = () => {
  const navigate = useNavigate();
  const { playButtonClick } = useAudio();
  
  // Use comprehensive user data hook
  const {
    profile,
    stats,
    loading
  } = useUserData();

  // Avatar selection state
  const [selectedAvatar, setSelectedAvatar] = useState<string>('soldier');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);

  // Load selected avatar from localStorage on component mount
  useEffect(() => {
    const savedAvatar = localStorage.getItem(STORAGE_KEY);
    if (savedAvatar && AVATAR_OPTIONS.find(avatar => avatar.id === savedAvatar)) {
      setSelectedAvatar(savedAvatar);
    }
  }, []);

  // Save avatar selection to localStorage
  const handleAvatarSelect = (avatarId: string) => {
    setSelectedAvatar(avatarId);
    localStorage.setItem(STORAGE_KEY, avatarId);
    setShowAvatarSelector(false);
    
    const selectedAvatarName = AVATAR_OPTIONS.find(avatar => avatar.id === avatarId)?.name || 'Unknown';
    toast.success(`🎭 Avatar updated! Now serving as: ${selectedAvatarName}`);
    
    console.log('✅ Avatar saved to localStorage:', avatarId);
  };

  // Get current avatar data
  const currentAvatar = AVATAR_OPTIONS.find(avatar => avatar.id === selectedAvatar) || AVATAR_OPTIONS[0];

  const handleSignOut = async () => {
    try {
      const signOutToast = toast.loading('🛡️ Ending tactical session...');
      
      await supabase.auth.signOut();
      
      toast.success('👋 Mission complete! Signed out successfully!', { id: signOutToast });
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('❌ Failed to sign out. Please try again.');
    }
  };

  if (loading.profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center relative overflow-hidden">
        {/* Military grid background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(5,150,105,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(5,150,105,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
        </div>
        <div className="text-center relative">
          <div className="w-16 h-16 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-6"></div>
          <p className="text-white text-xl font-bold">LOADING CONFIG...</p>
          <div className="flex items-center justify-center space-x-2 mt-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-100"></div>
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce delay-200"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Military grid background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(5,150,105,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(5,150,105,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-r from-slate-800/90 to-slate-900/90 backdrop-blur-xl border-b border-emerald-500/30 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <span className="text-white text-2xl">⚙️</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-black">SETTINGS</h1>
              <p className="text-emerald-300 font-bold">System Configuration</p>
            </div>
          </div>
          
          <button 
            onClick={() => {
              playButtonClick()
              navigate('/home')
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all duration-300 shadow-xl"
          >
            ← BACK
          </button>
        </div>
      </div>

      <div className="relative p-6 space-y-6">
        {/* User Profile */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">👤</span>
            </div>
            <h2 className="text-white text-xl font-black">PROFILE INFO</h2>
          </div>
          
          {profile && (
            <div className="space-y-4">
              {/* Avatar Display */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative">
                  <img
                    src={currentAvatar.path}
                    alt={currentAvatar.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = AVATAR_OPTIONS[0].path // Fallback to first avatar
                    }}
                  />
                  <button
                    onClick={() => {
                      playButtonClick()
                      setShowAvatarSelector(true)
                    }}
                    className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
                  >
                    <span className="text-white text-xs">✏️</span>
                  </button>
                </div>
                <div>
                  <p className="text-white font-bold">Current Avatar</p>
                  <p className="text-emerald-300 text-sm">{currentAvatar.name}</p>
                  <p className="text-emerald-400 text-xs font-mono">ID: {currentAvatar.id}</p>
                </div>
              </div>
              
              {/* Profile Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">FIRST NAME</label>
                  <p className="text-white text-lg font-bold">{profile.first_name}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">LAST NAME</label>
                  <p className="text-white text-lg font-bold">{profile.last_name}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">EMAIL</label>
                  <p className="text-white text-lg font-bold">{profile.email}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">ID NUMBER</label>
                  <p className="text-white text-lg font-bold">{profile.id_number}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">AGE</label>
                  <p className="text-white text-lg font-bold">{profile.age}</p>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
                  <label className="text-emerald-300 text-sm font-bold">SELECTED AVATAR</label>
                  <p className="text-white text-sm font-bold">{currentAvatar.name}</p>
                  <p className="text-emerald-300 text-xs">Stored locally in browser</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Audio Controls Section */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">🎧</span>
            </div>
            <h2 className="text-white text-xl font-black">AUDIO SETTINGS</h2>
          </div>
          
          <AudioControls />
        </div>

        {/* Performance Statistics */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">📊</span>
            </div>
            <h2 className="text-white text-xl font-black">PERFORMANCE STATS</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-2xl font-black text-emerald-400">{stats.total_scans}</div>
              <div className="text-emerald-300 text-sm font-bold">TOTAL SCANS</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-2xl font-black text-emerald-400">{stats.avg_score}%</div>
              <div className="text-emerald-300 text-sm font-bold">AVG SCORE</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-2xl font-black text-emerald-400">{stats.best_score}%</div>
              <div className="text-emerald-300 text-sm font-bold">BEST SCORE</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-emerald-500/20">
              <div className="text-2xl font-black text-emerald-400">{stats.streak_days}</div>
              <div className="text-emerald-300 text-sm font-bold">STREAK DAYS</div>
            </div>
          </div>
        </div>

        {/* Avatar Selector Modal */}
        {showAvatarSelector && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-2xl p-6 max-w-2xl w-full border border-emerald-500/30 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🎭</span>
                  </div>
                  <h3 className="text-xl font-black text-white">SELECT AVATAR</h3>
                </div>
                <button
                  onClick={() => {
                    playButtonClick()
                    setShowAvatarSelector(false)
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-700/50 rounded-lg"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {AVATAR_OPTIONS.map((avatar) => {
                  const isSelected = selectedAvatar === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      onClick={() => {
                        playButtonClick()
                        handleAvatarSelect(avatar.id)
                      }}
                      className={`relative p-3 rounded-xl transition-all duration-200 transform hover:scale-105 ${
                        isSelected 
                          ? 'bg-emerald-500/20 border-2 border-emerald-500 shadow-lg shadow-emerald-500/25' 
                          : 'bg-slate-700/50 border-2 border-slate-600 hover:border-emerald-400 hover:bg-slate-600/50'
                      }`}
                    >
                      <img
                        src={avatar.path}
                        alt={avatar.name}
                        className="w-full aspect-square rounded-lg object-cover mb-2"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                      <p className="text-white text-xs font-bold text-center">{avatar.name}</p>
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-emerald-400">🔒</span>
                  <p className="text-emerald-300 text-sm font-bold">Security Note</p>
                </div>
                <p className="text-emerald-200 text-xs">
                  Avatars are stored locally in your browser and use secure military-themed assets. 
                  No file uploads are allowed to prevent security vulnerabilities.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sign Out Button */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-red-500/20 shadow-2xl shadow-red-500/10">
          <button 
            onClick={() => {
              playButtonClick()
              handleSignOut()
            }}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-4 rounded-xl font-black hover:from-red-500 hover:to-red-600 transition-all duration-300 shadow-xl hover:shadow-red-500/25 transform hover:scale-[1.02] border border-red-500/50"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🚪</span>
              <span>SIGN OUT</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;