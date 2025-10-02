import { useNavigate } from 'react-router';
import { useUserData } from '../hooks/useUserData';
import supabase from '../supabase';

export const Settings = () => {
  const navigate = useNavigate();
  
  // Use comprehensive user data hook
  const {
    profile,
    stats,
    loading,
    error
  } = useUserData();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
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
            onClick={() => navigate('/home')}
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
                <img
                  src={profile.avatar || '/assets/avatar1.png'}
                  alt="Profile Avatar"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500/50"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = '/assets/avatar1.png' // Fallback
                  }}
                />
                <div>
                  <p className="text-white font-bold">Current Avatar</p>
                  <p className="text-emerald-300 text-sm">{profile.avatar?.split('/').pop() || 'Default'}</p>
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
                  <label className="text-emerald-300 text-sm font-bold">AVATAR PATH</label>
                  <p className="text-white text-sm font-mono">{profile.avatar}</p>
                </div>
              </div>
            </div>
          )}
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

        {/* Sign Out Button */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-red-500/20 shadow-2xl shadow-red-500/10">
          <button 
            onClick={handleSignOut}
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