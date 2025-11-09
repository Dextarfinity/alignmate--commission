import Home from './pages/Home'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Camera from './pages/Camera'
import Settings from './pages/Settings'
import BottomNavigation from './components/BottomNavigation'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingScreen from './components/LoadingScreen'
import RouteLoadingWrapper from './components/RouteLoadingWrapper'
import { LoadingProvider, useLoading } from './contexts/LoadingContext'
import { AudioProvider } from './contexts/AudioContext'
import { Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'react-hot-toast'

function AppContent() {
  const location = useLocation()
  const { loadingState } = useLoading()
  
  // Don't show navigation on landing and auth pages
  const showNavigation = !['/auth', '/'].includes(location.pathname)

  return (
    <div className="relative min-h-screen">
      {/* Global loading overlay - positioned at the very top */}
      {loadingState.isLoading && (
        <div className="fixed inset-0 z-[9999]">
          <LoadingScreen 
            message={loadingState.message}
            submessage={loadingState.submessage}
            progress={loadingState.progress}
            showProgress={loadingState.showProgress}
          />
        </div>
      )}

      <RouteLoadingWrapper>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/camera" element={
            <ProtectedRoute>
              <Camera />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          {/* Redirect old /scan route to /camera for backward compatibility */}
          <Route path="/Camera" element={
            <ProtectedRoute>
              <Camera />
            </ProtectedRoute>
          } />
        </Routes>
      </RouteLoadingWrapper>
      
      {showNavigation && <BottomNavigation />}
      
      {/* Add bottom padding when navigation is shown */}
      {showNavigation && <div className="h-20"></div>}
      
      {/* Toast notifications */}
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerClassName="!top-4"
        toastOptions={{
          // Define default options
          className: '',
          duration: 4000,
          style: {
            background: '#064e3b', // emerald-900
            color: '#d1fae5', // emerald-100
            border: '1px solid #065f46', // emerald-800
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          },
          // Define success style
          success: {
            iconTheme: {
              primary: '#10b981', // emerald-500
              secondary: '#064e3b', // emerald-900
            },
            style: {
              border: '1px solid #10b981', // emerald-500
            },
          },
          // Define error style
          error: {
            iconTheme: {
              primary: '#ef4444', // red-500
              secondary: '#7f1d1d', // red-900
            },
            style: {
              background: '#7f1d1d', // red-900
              color: '#fecaca', // red-200
              border: '1px solid #ef4444', // red-500
            },
          },
          // Define loading style
          loading: {
            iconTheme: {
              primary: '#f59e0b', // amber-500
              secondary: '#451a03', // amber-900
            },
            style: {
              background: '#451a03', // amber-900
              color: '#fef3c7', // amber-100
              border: '1px solid #f59e0b', // amber-500
            },
          },
        }}
      />
    </div>
  )
}

function App() {
  return (
    <LoadingProvider>
      <AudioProvider>
        <AppContent />
      </AudioProvider>
    </LoadingProvider>
  )
}

export default App
