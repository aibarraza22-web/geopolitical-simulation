import { useState } from 'react'
import {
  useScenarios, useScenarioTemplates, useCreateScenario, useRunScenario, Scenario
} from '../../api/scenarios'
import { format } from 'date-fns'
import clsx from 'clsx'
import { Play, Plus, ChevronDown, ChevronUp } from 'lucide-react'

function statusColor(status: Scenario['status']): string {
  switch (status) {
    case 'completed': return 'text-green-400'
    case 'running': return 'text-yellow-400'
    case 'failed': return 'text-red-400'
    default: return 'text-muted-foreground'
  }
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const [expanded, setExpanded] = useState(false)
  const run = useRunScenario()

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-semibold">{scenario.name}</span>
            <span className={clsx('text-xs uppercase', statusColor(scenario.status))}>
              ● {scenario.status}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {scenario.template_type.replace('_', ' ')} · Created {format(new Date(scenario.created_at), 'MMM d, yyyy HH:mm')}
          </div>
        </div>
        <div className="flex gap-2">
          {scenario.status === 'draft' && (
            <button
              onClick={() => run.mutate(scenario.id)}
              disabled={run.isPending}
              className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/80 disabled:opacity-50"
            >
              <Play size={12} />
              Run
            </button>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && scenario.results && (
        <div className="border-t border-border p-4 space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted rounded p-3">
              <div className="text-xs text-muted-foreground">Probability</div>
              <div className="text-lg font-bold text-primary">
                {(scenario.results.probability * 100).toFixed(0)}%
              </div>
            </div>
            <div className="bg-muted rounded p-3">
              <div className="text-xs text-muted-foreground">Entities Impacted</div>
              <div className="text-lg font-bold">{scenario.results.impacted_entities.length}</div>
            </div>
            <div className="bg-muted rounded p-3">
              <div className="text-xs text-muted-foreground">Confidence Interval</div>
              <div className="text-sm font-mono">
                P10: {scenario.results.confidence_interval.p10.toFixed(1)} /
                P90: {scenario.results.confidence_interval.p90.toFixed(1)}
              </div>
            </div>
          </div>

          {Object.keys(scenario.results.economic_impact).length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Economic Impact</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(scenario.results.economic_impact).map(([key, val]) => (
                  <div key={key} className="bg-muted rounded p-2">
                    <div className="text-xs text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                    <div className={clsx('font-mono text-sm', typeof val === 'number' && val < 0 ? 'text-red-400' : 'text-green-400')}>
                      {typeof val === 'number' ? `${val > 0 ? '+' : ''}${val.toFixed(2)}` : String(val)}
                      {key.includes('pct') ? '%' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scenario.results.impacted_entities.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Top Impacted Entities</div>
              <div className="space-y-1">
                {scenario.results.impacted_entities.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{e.entity_id.slice(0, 12)}... <span className="text-foreground">({e.type})</span></span>
                    <span className="text-red-400">+{e.delta.toFixed(1)} risk</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && !scenario.results && scenario.status !== 'running' && (
        <div className="border-t border-border p-4 text-muted-foreground text-sm">
          No results yet. Run the scenario to generate output.
        </div>
      )}
      {expanded && scenario.status === 'running' && (
        <div className="border-t border-border p-4 text-yellow-400 text-sm">
          Simulation in progress...
        </div>
      )}
    </div>
  )
}

function NewScenarioForm({ onClose }: { onClose: () => void }) {
  const { data: templates } = useScenarioTemplates()
  const create = useCreateScenario()
  const run = useRunScenario()

  const [name, setName] = useState('')
  const [templateType, setTemplateType] = useState('sanctions')
  const [paramsText, setParamsText] = useState(
    JSON.stringify({ target_entity_ids: [], sanction_scope: ['energy'], severity: 0.7, duration_months: 12 }, null, 2)
  )
  const [paramsError, setParamsError] = useState('')

  const handleTemplateChange = (type: string) => {
    setTemplateType(type)
    const defaults: Record<string, object> = {
      sanctions: { target_entity_ids: [], sanction_scope: ['energy'], severity: 0.7, duration_months: 12 },
      conflict_escalation: { region_entity_ids: [], escalation_level: 0.6, spillover_radius: 2 },
      trade_disruption: { corridor_entity_ids: [], disruption_fraction: 0.5, affected_commodities: [] },
      regulatory_shift: { sector_entity_ids: [], regulation_type: 'tariff', impact_score: 0.5 },
      supply_chain_shock: { source_entity_ids: [], shock_magnitude: 0.5, propagation_steps: 3 },
    }
    setParamsText(JSON.stringify(defaults[type] ?? {}, null, 2))
  }

  const handleSubmit = async () => {
    let params
    try {
      params = JSON.parse(paramsText)
      setParamsError('')
    } catch {
      setParamsError('Invalid JSON parameters')
      return
    }

    const scenario = await create.mutateAsync({ name, template_type: templateType, parameters: params })
    await run.mutateAsync(scenario.id)
    onClose()
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <h2 className="font-bold text-lg">New Scenario</h2>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Scenario Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Russia Energy Sanctions 2026"
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Template</label>
          <select
            value={templateType}
            onChange={e => handleTemplateChange(e.target.value)}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            {templates?.map(t => (
              <option key={t.type} value={t.type}>{t.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            {templates?.find(t => t.type === templateType)?.description}
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Parameters (JSON)</label>
          <textarea
            value={paramsText}
            onChange={e => setParamsText(e.target.value)}
            rows={8}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
          />
          {paramsError && <p className="text-red-400 text-xs mt-1">{paramsError}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!name || create.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/80 disabled:opacity-50"
        >
          <Play size={14} />
          Create & Run
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border border-border rounded text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function Scenarios() {
  const { data: scenarios, isLoading } = useScenarios()
  const [showNew, setShowNew] = useState(false)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Scenario Simulation</h1>
          <p className="text-muted-foreground text-sm">Model geopolitical shocks and their second-order effects</p>
        </div>
        <button
          onClick={() => setShowNew(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/80"
        >
          <Plus size={14} />
          New Scenario
        </button>
      </div>

      {showNew && <NewScenarioForm onClose={() => setShowNew(false)} />}

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Loading scenarios...</div>
      ) : (
        <div className="space-y-3">
          {scenarios?.map(s => <ScenarioCard key={s.id} scenario={s} />)}
          {scenarios?.length === 0 && (
            <div className="text-center text-muted-foreground py-12 text-sm">
              No scenarios yet. Create one to get started.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
