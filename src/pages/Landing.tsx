import { Link } from "react-router"

import poseFlow from "../assets/pose_flow.png"
import attentionSalute from "../assets/attention_salute.png"
import marchingSilhouette from "../assets/marching_silhouette.jpg"
import salutePose from "../assets/salute_pose.png"

export const Landing = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-green-700 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">AM</span>
              </div>
              <span className="text-xl font-bold text-green-800">Align Mate</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#features" className="text-green-700 hover:text-green-900 transition-colors">
                Features
              </a>
              <a href="#poses" className="text-green-700 hover:text-green-900 transition-colors">
                Poses
              </a>
              <a href="#about" className="text-green-700 hover:text-green-900 transition-colors">
                About
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-white to-green-100 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-6xl font-bold text-green-900 mb-6 leading-tight">
                Master Your Proper Posture
              </h1>
              <p className="text-xl text-gray-700 mb-8 leading-relaxed">
                Scan, correct, and perfect your ROTC stances with advanced AI-powered posture analysis. Train like a
                professional with real-time feedback.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/auth"
                  className="bg-green-700 text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-800 transition-colors text-center"
                >
                  Start Your Training Now
                </Link>
              </div>
            </div>
            <div className="relative">
              <img
                src={poseFlow || "/placeholder.svg"}
                alt="Military pose flow demonstration"
                className="w-full h-auto rounded-lg shadow-2xl bg-gray-200"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-green-900 mb-4">Advanced Training Features</h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Our AI-powered system provides comprehensive posture analysis and training for military personnel
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-lg bg-white shadow">
              <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-3">Real-time Analysis</h3>
              <p className="text-gray-700">
                Instant feedback on your posture with AI-powered computer vision technology
              </p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white shadow">
              <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-3">Multiple Poses</h3>
              <p className="text-gray-700">Train salutation, marching position, and attention stance with precision</p>
            </div>

            <div className="text-center p-6 rounded-lg bg-white shadow">
              <div className="w-16 h-16 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-3">Progress Tracking</h3>
              <p className="text-gray-700">Monitor your improvement with detailed scoring and performance metrics</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pose Demonstration Section */}
      <section id="poses" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-green-900 mb-4">Master These Essential Poses</h2>
            <p className="text-xl text-gray-700 max-w-3xl mx-auto">
              Perfect your military bearing with our comprehensive pose training system
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="flex-1 flex items-center justify-center bg-white p-4">
                <img
                  src={attentionSalute || "/placeholder.svg"}
                  alt="Attention and salute pose"
                  className="max-h-64 w-auto object-contain"
                  style={{ maxWidth: "100%" }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-green-900 mb-3">Attention & Salute</h3>
                <p className="text-gray-700 mb-4">
                  Learn proper attention stance and military salute with precise hand and body positioning
                </p>
                <div className="flex items-center text-green-700">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">AI Verified</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="flex-1 flex items-center justify-center bg-white p-4">
                <img
                  src={marchingSilhouette || "/placeholder.svg"}
                  alt="Marching position"
                  className="max-h-64 w-auto object-contain"
                  style={{ maxWidth: "100%" }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-green-900 mb-3">Marching Position</h3>
                <p className="text-gray-700 mb-4">
                  Master the proper marching stance with correct posture, arm swing, and step timing
                </p>
                <div className="flex items-center text-green-700">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">Real-time Feedback</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="flex-1 flex items-center justify-center bg-white p-4">
                <img
                  src={salutePose || "/placeholder.svg"}
                  alt="Perfect salute pose"
                  className="max-h-64 w-auto object-contain"
                  style={{ maxWidth: "100%" }}
                />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-green-900 mb-3">Perfect Salute</h3>
                <p className="text-gray-700 mb-4">
                  Achieve the perfect military salute with precise angle, timing, and form analysis
                </p>
                <div className="flex items-center text-green-700">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-medium">Precision Training</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-green-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-6">Ready to Perfect Your Military Posture?</h2>
          <p className="text-xl text-green-100 mb-8">
            Join thousands of military personnel who have improved their posture and bearing with our AI-powered
            training system
          </p>
          <Link
            to="/auth"
            className="bg-green-700 text-white px-8 py-4 rounded-lg font-semibold hover:bg-green-800 transition-colors inline-block"
          >
            Start Your Training Now
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-green-700 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AM</span>
                </div>
                <span className="text-xl font-bold">Align Mate</span>
              </div>
              <p className="text-gray-300">Advanced AI-powered military posture training for professional excellence</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Real-time Analysis</li>
                <li>Multiple Poses</li>
                <li>Progress Tracking</li>
                <li>AI Feedback</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Training</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Attention Stance</li>
                <li>Military Salute</li>
                <li>Marching Position</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support and Devs</h4>
              <ul className="space-y-2 text-gray-300">
                <li>Christian B. Abamo</li>
                <li>Jhon Leovil M. Avelino</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-green-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} Align Mate. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Landing
