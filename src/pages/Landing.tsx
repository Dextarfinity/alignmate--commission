import { Link } from "react-router"
import { useAuth } from "../hooks/useAuth"
import { useAudio } from "../contexts/AudioContext"

import poseFlow from "../assets/pose_flow.png"
import attentionSalute from "../assets/attention_salute.png"
import marchingSilhouette from "../assets/marching_silhouette.jpg"
import salutePose from "../assets/salute_pose.png"

export const Landing = () => {
  const { user } = useAuth()
  const { playButtonClick } = useAudio()
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 relative overflow-hidden">
      {/* Professional Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,78,59,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,78,59,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      
      {/* Subtle Military Accent Elements */}
      <div className="absolute top-20 left-20 w-2 h-2 bg-emerald-500/20 rounded-full animate-pulse"></div>
      <div className="absolute top-40 right-32 w-1 h-1 bg-emerald-400/30 rounded-full animate-pulse delay-1000"></div>
      <div className="absolute bottom-32 left-16 w-1 h-1 bg-emerald-600/20 rounded-full animate-pulse delay-2000"></div>
      
      {/* Header */}
      <header className="relative z-50 bg-slate-900/80 backdrop-blur-xl border-b border-emerald-500/20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <span className="text-white font-black text-lg tracking-wider">AM</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-xs">⭐</span>
                </div>
              </div>
              <div>
                <span className="text-2xl font-black text-white tracking-tight">ALIGN</span>
                <span className="text-2xl font-black text-emerald-400 tracking-tight">MATE</span>
                <div className="text-xs text-emerald-300 font-medium tracking-widest uppercase">Military Posture Training</div>
              </div>
            </div>
            <nav className="hidden md:flex space-x-8 items-center">
              <a href="#features" className="text-slate-300 hover:text-emerald-400 transition-all duration-300 font-medium tracking-wide hover:scale-105">
                CAPABILITIES
              </a>
              <a href="#poses" className="text-slate-300 hover:text-emerald-400 transition-all duration-300 font-medium tracking-wide hover:scale-105">
                TRAINING MODULES
              </a>
              <a href="#about" className="text-slate-300 hover:text-emerald-400 transition-all duration-300 font-medium tracking-wide hover:scale-105">
                MISSION
              </a>
              {user ? (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/home"
                    className="text-emerald-400 hover:text-emerald-300 transition-all duration-300 font-bold tracking-wide hover:scale-105"
                  >
                    COMMAND CENTER
                  </Link>
                  <Link
                    to="/auth"
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-3 rounded-lg font-bold text-sm hover:from-emerald-500 hover:to-emerald-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 transform hover:scale-105 border border-emerald-500/50"
                  >
                    ACCOUNT
                  </Link>
                </div>
              ) : (
                <Link
                  to="/auth"
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-3 rounded-lg font-bold text-sm hover:from-emerald-500 hover:to-emerald-600 transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-400/40 transform hover:scale-105 border border-emerald-500/50"
                >
                  ENLIST NOW
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-32 lg:py-40">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-emerald-900/30"></div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 backdrop-blur-sm">
                  <span className="text-emerald-400 text-sm">🎖️</span>
                  <span className="text-emerald-300 text-sm font-bold tracking-wide">MILITARY GRADE PRECISION</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight tracking-tight">
                  <span className="bg-gradient-to-r from-white to-emerald-200 bg-clip-text text-transparent">MASTER</span>
                  <br />
                  <span className="bg-gradient-to-r from-emerald-400 to-emerald-600 bg-clip-text text-transparent">TACTICAL</span>
                  <br />
                  <span className="text-white">POSTURE</span>
                </h1>
              </div>
              <p className="text-xl text-slate-300 leading-relaxed max-w-xl">
                Advanced AI-powered posture analysis for military training excellence. 
                Real-time feedback, precision correction, and professional development for elite performance standards.
              </p>
              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                {user ? (
                  <Link
                    to="/home"
                    className="group bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-10 py-5 rounded-xl font-black text-lg hover:from-emerald-500 hover:to-emerald-600 transition-all duration-300 text-center shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-400/40 transform hover:scale-105 border border-emerald-500/50 relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center justify-center space-x-3">
                      <span>🎯</span>
                      <span>ACCESS COMMAND CENTER</span>
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </Link>
                ) : (
                  <>
                    <Link
                      to="/auth"
                      className="group bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-10 py-5 rounded-xl font-black text-lg hover:from-emerald-500 hover:to-emerald-600 transition-all duration-300 text-center shadow-2xl shadow-emerald-500/25 hover:shadow-emerald-400/40 transform hover:scale-105 border border-emerald-500/50 relative overflow-hidden"
                    >
                      <span className="relative z-10 flex items-center justify-center space-x-3">
                        <span>🚀</span>
                        <span>BEGIN TRAINING</span>
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </Link>
                    <button
                      onClick={() => {
                        playButtonClick()
                        document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="group bg-slate-800/50 text-emerald-300 px-10 py-5 rounded-xl font-bold text-lg hover:bg-slate-700/50 transition-all duration-300 text-center border border-emerald-500/30 hover:border-emerald-400/50 backdrop-blur-sm transform hover:scale-105"
                    >
                      <span className="flex items-center justify-center space-x-3">
                        <span>📋</span>
                        <span>VIEW CAPABILITIES</span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="relative bg-gradient-to-br from-slate-800/80 to-emerald-900/80 rounded-2xl p-8 backdrop-blur-xl border border-emerald-500/30 shadow-2xl shadow-emerald-500/10">
                <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                  <span className="text-emerald-300 text-xs font-bold">CLASSIFIED</span>
                </div>
                <img
                  src={poseFlow || "/placeholder.svg"}
                  alt="Military tactical posture analysis system"
                  className="w-full h-auto rounded-xl shadow-xl bg-slate-700/50 border border-emerald-500/20"
                />
                <div className="absolute bottom-8 left-8 right-8 bg-slate-900/90 backdrop-blur-sm rounded-lg p-4 border border-emerald-500/30">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-300 text-sm font-bold">AI ANALYSIS ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-32 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-6">
              <span className="text-emerald-300 text-sm font-bold tracking-wider">TACTICAL CAPABILITIES</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
              ADVANCED <span className="text-emerald-400">TRAINING</span> SYSTEMS
            </h2>
            <p className="text-xl text-slate-300 max-w-4xl mx-auto leading-relaxed">
              Military-grade AI analysis providing precision posture assessment and tactical readiness evaluation
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 h-full hover:border-emerald-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">REAL-TIME ANALYSIS</h3>
                <p className="text-slate-300 leading-relaxed">
                  Instant AI-powered feedback on tactical posture with military-grade computer vision technology
                </p>
              </div>
            </div>

            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 h-full hover:border-emerald-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">MULTIPLE DISCIPLINES</h3>
                <p className="text-slate-300 leading-relaxed">
                  Master salutation, marching protocols, and attention stance with tactical precision
                </p>
              </div>
            </div>

            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-8 h-full hover:border-emerald-400/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">PROGRESS TRACKING</h3>
                <p className="text-slate-300 leading-relaxed">
                  Monitor tactical improvement with detailed scoring metrics and performance analytics
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pose Demonstration Section */}
      <section id="poses" className="py-32 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-emerald-500/5"></div>
          <div className="absolute top-1/3 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/3 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-20">
            <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-6">
              <span className="text-emerald-300 text-sm font-bold tracking-wider">TRAINING PROTOCOLS</span>
            </div>
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
              MASTER <span className="text-emerald-400">ESSENTIAL</span> POSITIONS
            </h2>
            <p className="text-xl text-slate-300 max-w-4xl mx-auto leading-relaxed">
              Perfect your military bearing with our comprehensive tactical posture training system
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl hover:border-emerald-400/40 transition-all duration-300 hover:shadow-emerald-500/10">
                <div className="relative bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-8 flex items-center justify-center min-h-[280px]">
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                    <span className="text-emerald-300 text-xs font-bold">ACTIVE</span>
                  </div>
                  <img
                    src={attentionSalute || "/placeholder.svg"}
                    alt="Attention and salute tactical position"
                    className="max-h-48 w-auto object-contain filter brightness-110 contrast-125"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">ATTENTION & SALUTE</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Master precise attention stance and military salute protocols with tactical positioning accuracy
                  </p>
                  <div className="flex items-center text-emerald-400">
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-bold">AI VERIFIED PROTOCOL</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl hover:border-emerald-400/40 transition-all duration-300 hover:shadow-emerald-500/10">
                <div className="relative bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-8 flex items-center justify-center min-h-[280px]">
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                    <span className="text-emerald-300 text-xs font-bold">ACTIVE</span>
                  </div>
                  <img
                    src={marchingSilhouette || "/placeholder.svg"}
                    alt="Marching tactical position"
                    className="max-h-48 w-auto object-contain filter brightness-110 contrast-125"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">MARCHING POSITION</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Execute proper marching stance with precision timing, arm coordination, and tactical bearing
                  </p>
                  <div className="flex items-center text-emerald-400">
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-bold">REAL-TIME FEEDBACK</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="group relative">
              <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl border border-emerald-500/20 rounded-2xl overflow-hidden shadow-2xl hover:border-emerald-400/40 transition-all duration-300 hover:shadow-emerald-500/10">
                <div className="relative bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-8 flex items-center justify-center min-h-[280px]">
                  <div className="absolute top-4 right-4 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full">
                    <span className="text-emerald-300 text-xs font-bold">ACTIVE</span>
                  </div>
                  <img
                    src={salutePose || "/placeholder.svg"}
                    alt="Perfect salute tactical position"
                    className="max-h-48 w-auto object-contain filter brightness-110 contrast-125"
                  />
                </div>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">PERFECT SALUTE</h3>
                  <p className="text-slate-300 mb-6 leading-relaxed">
                    Achieve tactical salute precision with exact angle analysis, timing protocols, and form verification
                  </p>
                  <div className="flex items-center text-emerald-400">
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-bold">PRECISION ANALYSIS</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-32 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-emerald-500/5"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <div className="inline-flex items-center px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full mb-8">
            <span className="text-emerald-300 text-sm font-bold tracking-wider">MISSION READY</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-8 leading-tight">
            READY TO MASTER <span className="text-emerald-400">TACTICAL</span> POSTURE?
          </h2>
          <p className="text-xl text-slate-300 mb-12 leading-relaxed max-w-3xl mx-auto">
            Join elite military personnel who have enhanced their bearing and tactical readiness with our AI-powered training command center
          </p>
          {user ? (
            <Link
              to="/home"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-2xl shadow-emerald-500/25 hover:scale-105 hover:shadow-emerald-500/40"
            >
              <span>🎯</span>
              <span className="ml-3">ACCESS COMMAND CENTER</span>
            </Link>
          ) : (
            <Link
              to="/auth"
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 shadow-2xl shadow-emerald-500/25 hover:scale-105 hover:shadow-emerald-500/40"
            >
              <span>🚀</span>
              <span className="ml-3">BEGIN TRAINING NOW</span>
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-slate-900 to-black text-white py-16 border-t border-emerald-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-black text-lg">AM</span>
                </div>
                <span className="text-2xl font-black text-white">ALIGNMATE</span>
              </div>
              <p className="text-slate-300 leading-relaxed">Advanced AI-powered military posture training for tactical excellence and professional bearing</p>
            </div>
            <div>
              <h4 className="font-bold text-emerald-400 mb-6 text-lg">TACTICAL SYSTEMS</h4>
              <ul className="space-y-3 text-slate-300">
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Real-time Analysis</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Multiple Protocols</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Progress Tracking</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">AI Feedback</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-emerald-400 mb-6 text-lg">TRAINING PROTOCOLS</h4>
              <ul className="space-y-3 text-slate-300">
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Attention Stance</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Military Salute</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Marching Position</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-emerald-400 mb-6 text-lg">COMMAND TEAM</h4>
              <ul className="space-y-3 text-slate-300">
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Christian B. Abamo</li>
                <li className="hover:text-emerald-400 transition-colors cursor-pointer">Jhon Leovil M. Avelino</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-emerald-500/20 mt-12 pt-8 text-center">
            <p className="text-slate-400">&copy; {new Date().getFullYear()} ALIGNMATE. All rights reserved. | Tactical Training Systems</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
