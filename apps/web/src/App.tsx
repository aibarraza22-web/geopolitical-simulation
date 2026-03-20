import { useState } from 'react'
import { Globe, BarChart3, FileSearch, Zap, Bell, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard/Dashboard'
import AnalystWorkspace from './pages/AnalystWorkspace/AnalystWorkspace'
import Scenarios from './pages/Scenarios/Scenarios'
import Alerts from './pages/Alerts/Alerts'
import clsx from 'clsx'

type Page = 'dashboard' | 'workspace' | 'scenarios' | 'alerts'

const NAV = [
  { id: 'dashboard' as Page, label: 'Risk Monitor', icon: Globe },
  { id: 'workspace' as Page, label: 'Intelligence', icon: FileSearch },
  { id: 'scenarios' as Page, label: 'Scenarios', icon: Zap },
  { id: 'alerts' as Page, label: 'Alerts', icon: Bell },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <nav className="w-56 flex flex-col border-r border-border bg-card shrink-0">
        <div className="p-4 border-b border-border">
          <div className="text-primary font-bold text-lg tracking-tight">GeoRisk</div>
          <div className="text-muted-foreground text-xs mt-0.5">Intelligence Platform</div>
        </div>

        <div className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                page === id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground">v0.1.0 — MVP</div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {page === 'dashboard' && <Dashboard />}
        {page === 'workspace' && <AnalystWorkspace />}
        {page === 'scenarios' && <Scenarios />}
        {page === 'alerts' && <Alerts />}
      </main>
    </div>
  )
}
