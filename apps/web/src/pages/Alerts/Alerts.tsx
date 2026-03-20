import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Plus, Trash2, Bell } from 'lucide-react'
import clsx from 'clsx'

const BASE = '/v1'

interface AlertRule {
  id: string
  name: string
  entity_id: string | null
  theme: string | null
  condition: string
  threshold: number
  delivery_channels: string[]
  is_active: boolean
  last_triggered_at: string | null
  created_at: string
}

interface AlertEvent {
  id: string
  rule_id: string
  entity_id: string
  theme: string
  triggered_score: number
  threshold: number
  triggered_at: string
}

function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/alerts/rules`)
      if (!res.ok) throw new Error('Failed to load alert rules')
      return res.json()
    },
  })
}

function useAlertHistory() {
  return useQuery<AlertEvent[]>({
    queryKey: ['alert-history'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/alerts/history`)
      if (!res.ok) throw new Error('Failed to load alert history')
      return res.json()
    },
    refetchInterval: 30_000,
  })
}

const THEMES = ['conflict', 'sanctions', 'political', 'economic', 'regulatory', 'supply_chain', 'trade']
const CONDITIONS = ['score_above', 'score_below', 'delta_above', 'delta_below']

function NewRuleForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    theme: 'conflict',
    condition: 'score_above',
    threshold: 70,
    delivery_channels: ['in_app'],
    webhook_url: '',
  })

  const create = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch(`${BASE}/alerts/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          webhook_url: payload.webhook_url || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to create rule')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] })
      onClose()
    },
  })

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <h2 className="font-bold">New Alert Rule</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Rule Name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Russia Conflict Alert"
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Theme</label>
          <select
            value={form.theme}
            onChange={e => setForm(f => ({ ...f, theme: e.target.value }))}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            {THEMES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Condition</label>
          <select
            value={form.condition}
            onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            {CONDITIONS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Threshold</label>
          <input
            type="number"
            value={form.threshold}
            onChange={e => setForm(f => ({ ...f, threshold: Number(e.target.value) }))}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Delivery</label>
          <div className="flex gap-3">
            {['in_app', 'webhook', 'email'].map(ch => (
              <label key={ch} className="flex items-center gap-1 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.delivery_channels.includes(ch)}
                  onChange={e => {
                    setForm(f => ({
                      ...f,
                      delivery_channels: e.target.checked
                        ? [...f.delivery_channels, ch]
                        : f.delivery_channels.filter(x => x !== ch),
                    }))
                  }}
                  className="accent-primary"
                />
                {ch}
              </label>
            ))}
          </div>
        </div>

        {form.delivery_channels.includes('webhook') && (
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground block mb-1">Webhook URL</label>
            <input
              value={form.webhook_url}
              onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => create.mutate(form)}
          disabled={!form.name || create.isPending}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/80 disabled:opacity-50"
        >
          Create Rule
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

export default function Alerts() {
  const { data: rules, isLoading: rulesLoading } = useAlertRules()
  const { data: history } = useAlertHistory()
  const [showNew, setShowNew] = useState(false)
  const qc = useQueryClient()

  const deleteRule = useMutation({
    mutationFn: async (ruleId: string) => {
      await fetch(`${BASE}/alerts/rules/${ruleId}`, { method: 'DELETE' })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alert-rules'] }),
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Alert Rules</h1>
          <p className="text-muted-foreground text-sm">Monitor threshold breaches across entities and themes</p>
        </div>
        <button
          onClick={() => setShowNew(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/80"
        >
          <Plus size={14} />
          New Rule
        </button>
      </div>

      {showNew && <NewRuleForm onClose={() => setShowNew(false)} />}

      <div className="grid grid-cols-2 gap-6">
        {/* Rules */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Rules</h2>
          {rulesLoading && <div className="text-muted-foreground text-sm">Loading...</div>}
          {rules?.map(rule => (
            <div key={rule.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={14} className={rule.is_active ? 'text-primary' : 'text-muted-foreground'} />
                  <span className="font-medium text-sm">{rule.name}</span>
                </div>
                <button
                  onClick={() => deleteRule.mutate(rule.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                <div>
                  Theme: <span className="text-foreground">{rule.theme ?? 'any'}</span> ·
                  Condition: <span className="text-foreground">{rule.condition.replace(/_/g, ' ')}</span> ·
                  Threshold: <span className="text-foreground">{rule.threshold}</span>
                </div>
                <div>Delivery: <span className="text-foreground">{rule.delivery_channels.join(', ')}</span></div>
                {rule.last_triggered_at && (
                  <div>Last triggered: <span className="text-accent">{format(new Date(rule.last_triggered_at), 'PPp')}</span></div>
                )}
              </div>
            </div>
          ))}
          {rules?.length === 0 && !rulesLoading && (
            <div className="text-muted-foreground text-sm py-4">No rules configured.</div>
          )}
        </div>

        {/* History */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Alert History</h2>
          {history?.length === 0 && (
            <div className="text-muted-foreground text-sm py-4">No alerts triggered yet.</div>
          )}
          {history?.map(event => (
            <div key={event.id} className="bg-card border border-destructive/30 rounded-lg p-3 text-sm">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-medium">{event.theme}</span> score{' '}
                  <span className="text-destructive font-bold">{event.triggered_score.toFixed(1)}</span>
                  {' '}exceeded threshold {event.threshold}
                </div>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(event.triggered_at), 'MM/dd HH:mm')}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                entity: {event.entity_id.slice(0, 12)}...
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
