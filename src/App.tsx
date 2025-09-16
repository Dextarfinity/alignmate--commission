import { Home } from './pages/Home'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import { Route, Routes } from 'react-router'

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/scan" element={<Home />} />
      </Routes>
    </div>
  )
}

export default App
