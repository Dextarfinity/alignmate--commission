import { Home } from './pages/Home'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Camera from './pages/Camera'
import { Settings } from './pages/Settings'
import BottomNavigation from './components/BottomNavigation'
import ProtectedRoute from './components/ProtectedRoute'
import { Route, Routes, useLocation } from 'react-router'

function App() {
  const location = useLocation()
  
  // Don't show navigation on landing and auth pages
  const showNavigation = !['/auth', '/'].includes(location.pathname)

  return (
    <div className="relative">
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
        <Route path="/scan" element={
          <ProtectedRoute>
            <Camera />
          </ProtectedRoute>
        } />
      </Routes>
      
      {showNavigation && <BottomNavigation />}
      
      {/* Add bottom padding when navigation is shown */}
      {showNavigation && <div className="h-20"></div>}
    </div>
  )
}

export default App
