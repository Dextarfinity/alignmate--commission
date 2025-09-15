import { Home } from './pages/Home'
import { Route, Routes } from 'react-router'

function App() {
  return (
    <div>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </div>
    </div>
    
  )
}

export default App
