"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAuth } from "../hooks/useAuth"
import supabase from '../supabase'

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
    age: "",
    ID_Number: "",
  })

  // Check if user is already logged in
  useEffect(() => {
    if (!authContextLoading && user) {
      navigate('/home')
    }
  }, [user, authContextLoading, navigate])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        age: "",
        ID_Number: "",
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
        if (formData.password !== formData.confirmPassword) {
          throw new Error("Passwords do not match")
        }

        // If first/last name are empty, try to extract from email
        let firstName = formData.firstName
        let lastName = formData.lastName
        let displayName = `${formData.firstName} ${formData.lastName}`.trim()

        if (!firstName || !lastName) {
          // Example: glomer.celestino@carsu.edu.ph => first: Glomer, last: Celestino
          const emailName = formData.email.split('@')[0]
          const parts = emailName.split(/[._]/)
          if (parts.length >= 2) {
            firstName = firstName || capitalize(parts[0])
            lastName = lastName || capitalize(parts[1])
            displayName = `${firstName} ${lastName}`
          } else {
            displayName = emailName
          }
        }

        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              display_name: displayName,
              first_name: firstName,
              last_name: lastName,
              avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`
            }
          }
        })

        if (error) throw error

        if (data.user) {
          // Insert profile into Additional_Information
          const { error: profileError } = await supabase
            .from('Additional_Information')
            .insert([
              {
                auth_users_id: data.user.id,
                first_name: firstName,
                last_name: lastName,
                age: Number(formData.age),
                "ID-Number": formData.ID_Number,
              }
            ])
          if (profileError) {
            console.error('Error creating profile:', profileError)
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

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/home`
        }
      })
      if (error) throw error
    } catch (err: unknown) {
      const error = err as Error
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to capitalize names
  function capitalize(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,_rgba(59,130,246,0.1),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(139,92,246,0.1),_transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_40%,_rgba(34,197,94,0.05),_transparent_50%)]"></div>
      </div>

      {/* Floating military elements */}
      <div className="absolute top-10 left-10 text-white/10 text-6xl animate-pulse">🎖️</div>
      <div className="absolute top-20 right-20 text-white/10 text-4xl animate-pulse delay-1000">⭐</div>
      <div className="absolute bottom-20 left-20 text-white/10 text-5xl animate-pulse delay-2000">🫡</div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
            <span className="text-white text-3xl">🎖️</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AlignMate Command</h1>
          <p className="text-blue-200">{isLogin ? "Access your training station" : "Join the elite posture corps"}</p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
          {/* Toggle Buttons */}
          <div className="flex bg-white/10 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                isLogin
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all duration-300 ${
                !isLogin
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'text-blue-200 hover:text-white hover:bg-white/10'
              }`}
            >
              Join Forces
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sign Up Fields */}
            {!isLogin && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="John"
                      required={!isLogin}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="Doe"
                      required={!isLogin}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="18"
                      required={!isLogin}
                      min={1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">ID Number</label>
                    <input
                      type="text"
                      name="ID_Number"
                      value={formData.ID_Number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                      placeholder="123456"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-sm font-semibold text-blue-200 mb-2">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                placeholder="john.doe@military.gov"
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-sm font-semibold text-blue-200 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                placeholder="••••••••"
                required
              />
            </div>

            {/* Confirm Password Field (Sign Up Only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-semibold text-blue-200 mb-2">Confirm Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                  placeholder="••••••••"
                  required={!isLogin}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-500 hover:to-purple-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] shadow-xl"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <span>{isLogin ? "Sign In" : "Join Forces"}</span>
                  <span>{isLogin ? "🚀" : "⚡"}</span>
                </div>
              )}
            </button>
          </form>

          {/* Google Sign In Button (show only on Sign In) */}
          {isLogin && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3 px-6 rounded-xl shadow-lg hover:bg-blue-50 transition-all duration-300 mb-6"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" className="w-6 h-6" />
              Continue with Google
            </button>
          )}
        </div>

        {/* Sign Out Option */}
        <div className="mt-4">
          <button
            onClick={handleSignOut}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 text-blue-200 hover:text-white py-3 px-4 rounded-xl font-medium border border-white/20 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center space-x-2">
              <span>🚪</span>
              <span>Sign Out Current Session</span>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-blue-300 text-sm">
            Built for elite military posture training
          </p>
        </div>
      </div>
    </div>
  )
}

export default Auth