import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const BASE = '/v1'

export interface RiskScore {
  id: string
  entity_id: string
  theme: string
  score: number
  confidence: number
  score_delta_7d: number | null
  computed_at: string
  signal_breakdown: Record<string, number>
  top_documents: string[]
  is_current: boolean
}

export interface HeatmapItem {
  entity_id: string
  entity_name: string
  entity_type: string
  iso_code: string | null
  theme: string
  score: number
  confidence: number
  delta_7d: number | null
}

export interface WeightConfig {
  id: string
  name: string
  is_default: boolean
  weights: Record<string, Record<string, number>>
  version: number
  created_at: string
}

export interface HistoryPoint {
  timestamp: string
  score: number
  confidence: number
}

// ── Heatmap ──────────────────────────────────────────────────────────────────

export function useHeatmap(theme: string, entityType: string = 'country') {
  return useQuery<HeatmapItem[]>({
    queryKey: ['heatmap', theme, entityType],
    queryFn: async () => {
      const res = await fetch(`${BASE}/risk/scores/heatmap?theme=${theme}&entity_type=${entityType}`)
      if (!res.ok) throw new Error('Failed to load heatmap')
      return res.json()
    },
    refetchInterval: 60_000,
  })
}

// ── Score history ─────────────────────────────────────────────────────────────

export function useScoreHistory(entityId: string, theme: string) {
  return useQuery<HistoryPoint[]>({
    queryKey: ['score-history', entityId, theme],
    queryFn: async () => {
      const res = await fetch(`${BASE}/risk/scores/history?entity_id=${entityId}&theme=${theme}`)
      if (!res.ok) throw new Error('Failed to load history')
      return res.json()
    },
    enabled: Boolean(entityId),
  })
}

// ── Risk scores ───────────────────────────────────────────────────────────────

export function useRiskScores(entityId?: string, theme?: string) {
  const params = new URLSearchParams({ is_current: 'true' })
  if (entityId) params.set('entity_id', entityId)
  if (theme) params.set('theme', theme)

  return useQuery<RiskScore[]>({
    queryKey: ['risk-scores', entityId, theme],
    queryFn: async () => {
      const res = await fetch(`${BASE}/risk/scores?${params}`)
      if (!res.ok) throw new Error('Failed to load scores')
      return res.json()
    },
    refetchInterval: 30_000,
  })
}

// ── Weight configurations ─────────────────────────────────────────────────────

export function useWeightConfigs() {
  return useQuery<WeightConfig[]>({
    queryKey: ['weight-configs'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/risk/weights`)
      if (!res.ok) throw new Error('Failed to load weight configs')
      return res.json()
    },
  })
}

export function useCreateWeightConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; weights: Record<string, Record<string, number>> }) => {
      const res = await fetch(`${BASE}/risk/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to create weight config')
      return res.json()
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weight-configs'] }),
  })
}

// ── Recompute ─────────────────────────────────────────────────────────────────

export function useRecompute() {
  return useMutation({
    mutationFn: async (payload: { entity_ids?: string[]; themes?: string[]; weight_config_id?: string }) => {
      const res = await fetch(`${BASE}/risk/recompute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Recompute failed')
      return res.json()
    },
  })
}
