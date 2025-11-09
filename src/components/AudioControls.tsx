import { useAudio } from '../contexts/AudioContext'

export default function AudioControls() {
  const { isMusicEnabled, isSfxEnabled, toggleMusic, toggleSfx, playButtonClick } = useAudio()

  const handleMusicToggle = () => {
    playButtonClick()
    toggleMusic()
  }

  const handleSfxToggle = () => {
    // Don't play click sound when turning off SFX (would be confusing)
    if (isSfxEnabled) {
      playButtonClick()
    }
    toggleSfx()
  }

  return (
    <div className="space-y-4">
      {/* Background Music Control */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🎵</div>
          <div>
            <h3 className="text-white font-semibold">Background Music</h3>
            <p className="text-slate-400 text-sm">Play ambient music while using the app</p>
          </div>
        </div>
        <button
          onClick={handleMusicToggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${
            isMusicEnabled ? 'bg-emerald-600' : 'bg-slate-600'
          }`}
          aria-label="Toggle background music"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${
              isMusicEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Sound Effects Control */}
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="text-2xl">🔊</div>
          <div>
            <h3 className="text-white font-semibold">Sound Effects</h3>
            <p className="text-slate-400 text-sm">Play sounds for button clicks and actions</p>
          </div>
        </div>
        <button
          onClick={handleSfxToggle}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors duration-300 ${
            isSfxEnabled ? 'bg-emerald-600' : 'bg-slate-600'
          }`}
          aria-label="Toggle sound effects"
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 ${
              isSfxEnabled ? 'translate-x-7' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Info text */}
      <p className="text-slate-500 text-xs text-center px-4">
        Audio preferences are saved automatically
      </p>
    </div>
  )
}
