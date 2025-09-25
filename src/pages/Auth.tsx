"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "../hooks/useAuth"
import supabase from "../supabase"

const Auth = () => {
  const navigate = useNavigate()
  const { user, loading: authContextLoading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    idNumber: "",
    age: "",
  })

  // Check if user is already logged in
  useEffect(() => {
    if (!authContextLoading && user) {
      navigate('/home')
    }
  }, [user, authContextLoading, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      // Clear form data
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        firstName: "",
        lastName: "",
        idNumber: "",
        age: "",
      })
      setError(null)
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (isLogin) {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error

        if (data.user) {
          navigate('/home')
        }
      } else {
        // Sign up new user
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        })

        if (error) throw error

        if (data.user) {
          // Create profile record
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                first_name: formData.firstName,
                last_name: formData.lastName,
                id_number: formData.idNumber,
                age: parseInt(formData.age),
                email: formData.email,
              }
            ])

          if (profileError) {
            console.error('Error creating profile:', profileError)
          }

          // Create default user settings
          const { error: settingsError } = await supabase
            .from('user_settings')
            .insert([
              {
                user_id: data.user.id,
                notifications_enabled: true,
                camera_auto_focus: true,
                save_scan_history: true,
              }
            ])

          if (settingsError) {
            console.error('Error creating user settings:', settingsError)
          }

          navigate('/home')
        }
      }
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Military Camo Pattern Background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-[conic-gradient(from_0deg_at_50%_50%,_rgba(34,197,94,0.1)_0deg,_rgba(22,163,74,0.1)_90deg,_rgba(34,197,94,0.1)_180deg,_rgba(21,128,61,0.1)_270deg)]"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,_rgba(34,197,94,0.08),_transparent_50%)]"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_25%,_rgba(22,163,74,0.08),_transparent_50%)]"></div>
        <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_75%,_rgba(21,128,61,0.08),_transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_75%,_rgba(16,185,129,0.08),_transparent_50%)]"></div>
      </div>

      {/* Floating military elements */}
      <div className="absolute top-10 left-10 text-emerald-500/20 text-6xl animate-pulse">🎖️</div>
      <div className="absolute top-20 right-20 text-green-400/20 text-4xl animate-pulse delay-1000">⭐</div>
      <div className="absolute bottom-20 left-20 text-emerald-600/20 text-5xl animate-pulse delay-2000">🫡</div>
      <div className="absolute bottom-10 right-10 text-green-500/20 text-3xl animate-pulse delay-500">🏆</div>
      <div className="absolute top-1/2 left-5 text-emerald-400/15 text-8xl animate-pulse delay-1500">🎯</div>
      <div className="absolute top-1/3 right-5 text-green-600/15 text-7xl animate-pulse delay-2500">�️</div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-emerald-600 to-green-700 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl animate-pulse">
            <span className="text-white text-3xl">🫡</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">🎖️ ALIGNMATE COMMAND 🎖️</h1>
          <p className="text-emerald-200">{isLogin ? "Access your tactical station" : "Join the elite posture battalion"}</p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-emerald-500/30 shadow-2xl">
          {/* Toggle Buttons */}
          <div className="flex bg-white/10 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                isLogin
                  ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg'
                  : 'text-emerald-200 hover:text-white hover:bg-white/10'
              }`}
            >
              TACTICAL LOGIN
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                !isLogin
                  ? 'bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-lg'
                  : 'text-emerald-200 hover:text-white hover:bg-white/10'
              }`}
            >
              RECRUIT ENLIST
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-400/40 rounded-xl backdrop-blur-sm">
              <p className="text-red-200 text-sm font-medium">⚠️ {error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sign Up Fields */}
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-200 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                      placeholder="John"
                      required={!isLogin}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-200 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                      placeholder="Doe"
                      required={!isLogin}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-emerald-200 mb-2">ID Number</label>
                    <input
                      type="text"
                      name="idNumber"
                      value={formData.idNumber}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                      placeholder="221-01682"
                      required={!isLogin}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-emerald-200 mb-2">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                      placeholder="25"
                      min="18"
                      max="65"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-emerald-200 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                placeholder="john.doe@military.gov"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-emerald-200 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Confirm Password Field (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-emerald-200 mb-2">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300"
                  placeholder="••••••••"
                  required={!isLogin}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-emerald-500 hover:to-green-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span>{isLogin ? "MISSION START" : "ENLIST NOW"}</span>
                  <span>{isLogin ? "🎯" : "🫡"}</span>
                </div>
              )}
            </button>
          </form>
          
          {/* Toggle Link */}
          <div className="text-center mt-6">
            <p className="text-emerald-300 text-sm">
              {isLogin ? "New recruit?" : "Already enlisted?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline transition-colors duration-200"
              >
                {isLogin ? "Join the battalion" : "Access your station"}
              </button>
            </p>
          </div>
        </div>

        {/* Sign Out Option */}
        <div className="mt-4">
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 text-emerald-200 hover:text-white py-3 px-4 rounded-xl font-medium border border-emerald-500/30 hover:border-emerald-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🏃‍♂️</span>
              <span>End Current Mission</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-emerald-300 text-sm">
            🎖️ Built for elite military posture training 🎖️
          </p>
        </div>
      </div>
    </div>
  )
}

export default Auth