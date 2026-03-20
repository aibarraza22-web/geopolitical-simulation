import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const BASE = '/v1'

export interface ScenarioTemplate {
  type: string
  name: string
  description: string
  parameter_schema: Record<string, unknown>
}

export interface Scenario {
  id: string
  name: string
  template_type: string
  status: 'draft' | 'running' | 'completed' | 'failed'
  parameters: Record<string, unknown>
  results: ScenarioResults | null
  created_at: string
  completed_at: string | null
}

export interface ScenarioResults {
  probability: number
  impacted_entities: Array<{ entity_id: string; type: string; delta: number }>
  score_deltas: Record<string, number>
  economic_impact: Record<string, number>
  confidence_interval: { p10: number; p50: number; p90: number }
}

export function useScenarioTemplates() {
  return useQuery<ScenarioTemplate[]>({
    queryKey: ['scenario-templates'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/scenarios/templates`)
      if (!res.ok) throw new Error('Failed to load templates')
      return res.json()
    },
  })
}

export function useScenarios() {
  return useQuery<Scenario[]>({
    queryKey: ['scenarios'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/scenarios`)
      if (!res.ok) throw new Error('Failed to load scenarios')
      return res.json()
    },
  })
}

export function useScenario(id: string) {
  return useQuery<Scenario>({
    queryKey: ['scenario', id],
    queryFn: async () => {
      const res = await fetch(`${BASE}/scenarios/${id}`)
      if (!res.ok) throw new Error('Scenario not found')
      return res.json()
    },
    refetchInterval: (data) => (data?.status === 'running' ? 3000 : false),
  })
}

export function useCreateScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; template_type: string; parameters: Record<string, unknown> }) => {
      const res = await fetch(`${BASE}/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create scenario')
      return res.json() as Promise<Scenario>
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] }),
  })
}

export function useRunScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scenarioId: string) => {
      const res = await fetch(`${BASE}/scenarios/${scenarioId}/run`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to run scenario')
      return res.json()
    },
    onSuccess: (_data, scenarioId) => {
      qc.invalidateQueries({ queryKey: ['scenario', scenarioId] })
      qc.invalidateQueries({ queryKey: ['scenarios'] })
    },
  })
}
