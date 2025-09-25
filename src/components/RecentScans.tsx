import React from 'react'

type Scan = {
  id: string
  postureType: string
  score: number
  success: boolean
  date: string
}

type Props = { scans: Scan[] }

const RecentScans: React.FC<Props> = ({ scans }) => {
  if (!scans || scans.length === 0) {
    return (
      <div className="text-center py-8 text-slate-300">No recent scans</div>
    )
  }

  return (
    <div className="space-y-4">
      {scans.map((s) => (
        <div key={s.id} className="bg-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">{s.postureType.charAt(0)}</div>
            <div>
              <div className="text-white font-bold">{s.postureType}</div>
              <div className="text-slate-300 text-sm">{s.date}</div>
            </div>
          </div>
          <div className={`text-2xl font-black ${s.success ? 'text-emerald-400' : 'text-red-400'}`}>{s.score}%</div>
        </div>
      ))}
    </div>
  )
}

export default RecentScans
