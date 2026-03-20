import { useState } from 'react'
import { useHeatmap, useScoreHistory } from '../../api/risk'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { format } from 'date-fns'
import clsx from 'clsx'

const THEMES = ['conflict', 'sanctions', 'political', 'economic', 'regulatory', 'supply_chain', 'trade']

function riskColor(score: number): string {
  if (score >= 75) return 'text-red-500'
  if (score >= 55) return 'text-orange-500'
  if (score >= 35) return 'text-yellow-500'
  if (score >= 15) return 'text-green-500'
  return 'text-gray-500'
}

function riskBg(score: number): string {
  if (score >= 75) return 'bg-red-500'
  if (score >= 55) return 'bg-orange-500'
  if (score >= 35) return 'bg-yellow-400'
  return 'bg-green-500'
}

function riskLabel(score: number): string {
  if (score >= 75) return 'CRITICAL'
  if (score >= 55) return 'HIGH'
  if (score >= 35) return 'MEDIUM'
  if (score >= 15) return 'LOW'
  return 'MINIMAL'
}

export default function Dashboard() {
  const [theme, setTheme] = useState('conflict')
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string } | null>(null)

  const { data: heatmap, isLoading } = useHeatmap(theme)
  const { data: history } = useScoreHistory(selectedEntity?.id ?? '', theme)

  const sorted = [...(heatmap ?? [])].sort((a, b) => b.score - a.score)
  const topMovers = [...(heatmap ?? [])]
    .filter(x => x.delta_7d !== null)
    .sort((a, b) => Math.abs(b.delta_7d!) - Math.abs(a.delta_7d!))
    .slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Risk Monitor</h1>
          <p className="text-muted-foreground text-sm">Real-time geopolitical risk scores by country</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Auto-refresh every 60s
        </div>
      </div>

      {/* Theme selector */}
      <div className="flex gap-2 flex-wrap">
        {THEMES.map(t => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={clsx(
              'px-3 py-1 rounded text-xs border transition-colors',
              theme === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            {t.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Score table */}
        <div className="col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="p-3 border-b border-border text-sm font-semibold">
            Country Risk Scores — {theme.replace('_', ' ').toUpperCase()}
          </div>
          {isLoading ? (
            <div className="p-6 text-muted-foreground text-sm">Loading scores...</div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-3 text-muted-foreground font-normal">#</th>
                    <th className="text-left p-3 text-muted-foreground font-normal">Country</th>
                    <th className="text-left p-3 text-muted-foreground font-normal">Score</th>
                    <th className="text-left p-3 text-muted-foreground font-normal">Level</th>
                    <th className="text-left p-3 text-muted-foreground font-normal">7d Δ</th>
                    <th className="text-left p-3 text-muted-foreground font-normal">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item, i) => (
                    <tr
                      key={item.entity_id}
                      onClick={() => setSelectedEntity({ id: item.entity_id, name: item.entity_name })}
                      className={clsx(
                        'border-t border-border cursor-pointer hover:bg-muted/50',
                        selectedEntity?.id === item.entity_id && 'bg-primary/5'
                      )}
                    >
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{item.entity_name}</td>
                      <td className={clsx('p-3 font-bold tabular-nums', riskColor(item.score))}>
                        {item.score.toFixed(1)}
                      </td>
                      <td className="p-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded', riskColor(item.score))}>
                          {riskLabel(item.score)}
                        </span>
                      </td>
                      <td className="p-3 tabular-nums">
                        {item.delta_7d !== null ? (
                          <span className={item.delta_7d > 0 ? 'text-red-400' : 'text-green-400'}>
                            {item.delta_7d > 0 ? '+' : ''}{item.delta_7d?.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${item.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        No scores available. Run the ingestion pipeline to generate data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Top movers */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border text-sm font-semibold">Top Movers (7d)</div>
            <div className="p-3 space-y-2">
              {topMovers.length === 0 ? (
                <p className="text-muted-foreground text-xs">No movement data yet.</p>
              ) : (
                topMovers.map(item => (
                  <div
                    key={item.entity_id}
                    className="flex items-center justify-between cursor-pointer hover:bg-muted/30 rounded px-1"
                    onClick={() => setSelectedEntity({ id: item.entity_id, name: item.entity_name })}
                  >
                    <span className="text-sm truncate">{item.entity_name}</span>
                    <span className={clsx(
                      'text-xs font-mono tabular-nums',
                      (item.delta_7d ?? 0) > 0 ? 'text-red-400' : 'text-green-400'
                    )}>
                      {(item.delta_7d ?? 0) > 0 ? '+' : ''}{item.delta_7d?.toFixed(1)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Score history chart */}
          {selectedEntity && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-3 border-b border-border text-sm font-semibold">
                {selectedEntity.name} — History
              </div>
              <div className="p-3">
                {!history || history.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No history available.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={history.map(h => ({
                      ...h,
                      t: format(new Date(h.timestamp), 'MM/dd'),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="t" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
