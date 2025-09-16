import { useLocation, useNavigate } from 'react-router'

interface NavItem {
  path: string
  icon: string
  label: string
}

export const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()

  const navItems: NavItem[] = [
    { path: '/home', icon: '📊', label: 'Home' },
    { path: '/camera', icon: '📷', label: 'Camera' },
    { path: '/settings', icon: '⚙️', label: 'Settings' }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-green-700 border-t border-green-600 z-50">
      <div className="flex">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex-1 py-3 px-4 text-center transition-colors ${
              location.pathname === item.path
                ? 'bg-green-600 text-white'
                : 'text-green-100 hover:bg-green-600 hover:text-white'
            }`}
          >
            <div className="text-xl mb-1">{item.icon}</div>
            <div className="text-xs font-medium">{item.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default BottomNavigation