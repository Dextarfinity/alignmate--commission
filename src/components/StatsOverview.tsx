import React from 'react'

type Props = {
  totalScans: number
  avgScore: number
  successRate: number
  successfulScans: number
}

const StatsOverview: React.FC<Props> = ({ totalScans, avgScore, successRate, successfulScans }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-slate-800 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{totalScans}</div>
        <div className="text-sm text-slate-300">TOTAL SCANS</div>
      </div>
      <div className="bg-slate-800 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{avgScore}%</div>
        <div className="text-sm text-slate-300">AVG SCORE</div>
      </div>
      <div className="bg-slate-800 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{successRate}%</div>
        <div className="text-sm text-slate-300">SUCCESS RATE</div>
      </div>
      <div className="bg-slate-800 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{successfulScans}</div>
        <div className="text-sm text-slate-300">SUCCESSFUL</div>
      </div>
    </div>
  )
}

export default React.memo(StatsOverview)
