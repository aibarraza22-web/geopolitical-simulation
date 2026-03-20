import { useQuery } from '@tanstack/react-query'

const BASE = '/v1'

export interface IntelligenceDocument {
  id: string
  source_id: string
  raw_url: string
  title: string
  body_text: string
  published_at: string | null
  ingested_at: string
  language: string
  source_type: string
  entities_mentioned: string[]
  sentiment_score: number | null
  relevance_score: number | null
}

export interface DocumentSearchResult {
  items: IntelligenceDocument[]
  total: number
  page: number
  limit: number
}

export function useDocuments(params: {
  entity_id?: string
  source_type?: string
  q?: string
  page?: number
  limit?: number
}) {
  const query = new URLSearchParams()
  if (params.entity_id) query.set('entity_id', params.entity_id)
  if (params.source_type) query.set('source_type', params.source_type)
  if (params.q) query.set('q', params.q)
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))

  return useQuery<DocumentSearchResult>({
    queryKey: ['documents', params],
    queryFn: async () => {
      const res = await fetch(`${BASE}/intelligence/documents?${query}`)
      if (!res.ok) throw new Error('Failed to load documents')
      return res.json()
    },
  })
}

export function useDataSources() {
  return useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => {
      const res = await fetch(`${BASE}/intelligence/sources`)
      if (!res.ok) throw new Error('Failed to load sources')
      return res.json()
    },
  })
}
