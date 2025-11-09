import { useLocation, useNavigate } from 'react-router'
import { useAudio } from '../contexts/AudioContext'

interface NavItem {
  path: string
  icon: string
  label: string
  militaryCode: string
}

export const BottomNavigation = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { playButtonClick } = useAudio()

  const navItems: NavItem[] = [
    { path: '/home', icon: '🎯', label: 'Command', militaryCode: 'CMD' },
    { path: '/camera', icon: '�', label: 'Scanner', militaryCode: 'SCN' },
    { path: '/settings', icon: '⚙️', label: 'Config', militaryCode: 'CFG' }
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 via-slate-800 to-slate-900 border-t border-emerald-500/30 backdrop-blur-xl z-50 shadow-2xl shadow-emerald-500/10">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent"></div>
      
      <div className="flex relative">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path
          
          return (
            <button
              key={item.path}
              onClick={() => {
                playButtonClick()
                navigate(item.path)
              }}
              className={`group flex-1 py-4 px-4 text-center transition-all duration-300 relative overflow-hidden ${
                isActive
                  ? 'text-emerald-400'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-b-full"></div>
              )}
              
              {/* Background glow on hover */}
              <div className={`absolute inset-0 bg-gradient-to-t from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                isActive ? 'opacity-100' : ''
              }`}></div>
              
              {/* Content */}
              <div className="relative z-10">
                <div className={`text-xl mb-1 transform transition-transform duration-300 ${
                  isActive ? 'scale-110' : 'group-hover:scale-105'
                }`}>
                  {item.icon}
                </div>
                <div className={`text-xs font-bold tracking-wider transition-all duration-300 ${
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-emerald-300'
                }`}>
                  {item.label.toUpperCase()}
                </div>
                <div className={`text-[10px] font-mono mt-1 transition-all duration-300 ${
                  isActive ? 'text-emerald-500 opacity-100' : 'text-slate-600 opacity-70 group-hover:text-emerald-400 group-hover:opacity-100'
                }`}>
                  [{item.militaryCode}]
                </div>
              </div>
              
              {/* Separator line */}
              {index < navItems.length - 1 && (
                <div className="absolute right-0 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-slate-700 to-transparent"></div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default BottomNavigation