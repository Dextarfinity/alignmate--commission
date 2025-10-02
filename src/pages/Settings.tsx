import { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router';
import supabase from '../supabase';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  id_number: string;
  age: number;
}

interface UserSettings {
  notifications_enabled: boolean;
  camera_auto_focus: boolean;
  save_scan_history: boolean;
  dark_mode: boolean;
  sound_effects: boolean;
  daily_reminders: boolean;
  performance_tracking: boolean;
}

interface UserStats {
  total_scans: number;
  avg_score: number;
  best_score: number;
  streak_days: number;
}

export const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    notifications_enabled: true,
    camera_auto_focus: true,
    save_scan_history: true,
    dark_mode: false,
    sound_effects: true,
    daily_reminders: true,
    performance_tracking: true
  });
  const [stats, setStats] = useState<UserStats>({
    total_scans: 0,
    avg_score: 0,
    best_score: 0,
    streak_days: 0
  });

  const loadUserData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate('/auth');
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (settingsData) {
        setSettings({
          notifications_enabled: settingsData.notifications_enabled,
          camera_auto_focus: settingsData.camera_auto_focus,
          save_scan_history: settingsData.save_scan_history,
          dark_mode: settingsData.dark_mode || false,
          sound_effects: settingsData.sound_effects || true,
          daily_reminders: settingsData.daily_reminders || true,
          performance_tracking: settingsData.performance_tracking || true
        });
      }

      // Load stats
      const { data: scanData } = await supabase
        .from('scan_history')
        .select('score, created_at')
        .eq('user_id', session.user.id);

      if (scanData && scanData.length > 0) {
        const totalScans = scanData.length;
        const avgScore = Math.round(scanData.reduce((sum, scan) => sum + scan.score, 0) / totalScans);
        const bestScore = Math.max(...scanData.map(scan => scan.score));
        
        setStats({
          total_scans: totalScans,
          avg_score: avgScore,
          best_score: bestScore,
          streak_days: 7 // Simplified
        });
      }

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleSetting = async (key: keyof UserSettings) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const newValue = !settings[key];
      
      await supabase
        .from('user_settings')
        .update({ [key]: newValue })
        .eq('user_id', session.user.id);

      setSettings(prev => ({ ...prev, [key]: newValue }));
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  if (loading) {
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
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-300 text-sm font-bold">ACCESSING PROFILE</span>
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
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-2xl shadow-emerald-500/25">
              <span className="text-white text-xl font-bold">⚙️</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-black tracking-tight">CONFIG</h1>
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <p className="text-emerald-300 text-sm font-bold">TACTICAL SETTINGS</p>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleSignOut}
            className="bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-xl font-bold transition-all duration-300 border border-red-500/50 hover:border-red-400/50 shadow-xl shadow-red-500/25"
          >
            <span>🚪</span>
            <span className="ml-2">SIGN OUT</span>
          </button>
        </div>
      </div>

      <div className="relative p-6 space-y-6">
        {/* User Stats */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">📊</span>
            </div>
            <h2 className="text-white text-xl font-black">TRAINING STATS</h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div className="text-2xl font-black text-white">{stats.total_scans}</div>
              <div className="text-sm text-emerald-300 font-bold">TOTAL SCANS</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div className="text-2xl font-black text-white">{stats.avg_score}%</div>
              <div className="text-sm text-emerald-300 font-bold">AVG SCORE</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div className="text-2xl font-black text-white">{stats.best_score}%</div>
              <div className="text-sm text-emerald-300 font-bold">BEST SCORE</div>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 text-center border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div className="text-2xl font-black text-white">{stats.streak_days}</div>
              <div className="text-sm text-emerald-300 font-bold">STREAK DAYS</div>
            </div>
          </div>
        </div>

        {/* Profile Section */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">👤</span>
            </div>
            <h2 className="text-white text-xl font-black">OPERATOR PROFILE</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-emerald-300 text-sm font-bold mb-2">FIRST NAME</label>
              <div className="bg-slate-900/50 p-4 rounded-xl text-white border border-emerald-500/20 font-bold">
                {profile?.first_name || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-sm font-bold mb-2">LAST NAME</label>
              <div className="bg-slate-900/50 p-4 rounded-xl text-white border border-emerald-500/20 font-bold">
                {profile?.last_name || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-sm font-bold mb-2">EMAIL</label>
              <div className="bg-slate-900/50 p-4 rounded-xl text-white border border-emerald-500/20 font-bold">
                {profile?.email || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-sm font-bold mb-2">ID NUMBER</label>
              <div className="bg-slate-900/50 p-4 rounded-xl text-white border border-emerald-500/20 font-bold">
                {profile?.id_number || 'Not set'}
              </div>
            </div>
            <div>
              <label className="block text-emerald-300 text-sm font-bold mb-2">AGE</label>
              <div className="bg-slate-900/50 p-4 rounded-xl text-white border border-emerald-500/20 font-bold">
                {profile?.age || 'Not set'}
              </div>
            </div>
          </div>
        </div>

        {/* App Settings */}
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-xl">
              <span className="text-white text-sm">⚙️</span>
            </div>
            <h2 className="text-white text-xl font-black">SYSTEM CONFIG</h2>
          </div>

          <div className="space-y-4">
            {/* Settings toggles */}
            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div>
                <h3 className="text-white font-bold">NOTIFICATIONS</h3>
                <p className="text-emerald-300 text-sm font-medium">Training alerts and updates</p>
              </div>
              <button
                onClick={() => toggleSetting('notifications_enabled')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.notifications_enabled ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.notifications_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div>
                <h3 className="text-white font-bold">AUTO FOCUS</h3>
                <p className="text-emerald-300 text-sm font-medium">Camera auto-focus during scans</p>
              </div>
              <button
                onClick={() => toggleSetting('camera_auto_focus')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.camera_auto_focus ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.camera_auto_focus ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div>
                <h3 className="text-white font-bold">SOUND EFFECTS</h3>
                <p className="text-emerald-300 text-sm font-medium">Audio feedback and alerts</p>
              </div>
              <button
                onClick={() => toggleSetting('sound_effects')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.sound_effects ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.sound_effects ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-emerald-500/20 hover:border-emerald-400/40 transition-all duration-300">
              <div>
                <h3 className="text-white font-bold">DAILY ALERTS</h3>
                <p className="text-emerald-300 text-sm font-medium">Training reminders and briefings</p>
              </div>
              <button
                onClick={() => toggleSetting('daily_reminders')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                  settings.daily_reminders ? 'bg-emerald-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                    settings.daily_reminders ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
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