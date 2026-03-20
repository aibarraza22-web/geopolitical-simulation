import { useState } from 'react'
import { useDocuments, useDataSources } from '../../api/intelligence'
import { format } from 'date-fns'
import clsx from 'clsx'
import { Search, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

function sentimentColor(s: number | null): string {
  if (s === null) return 'text-muted-foreground'
  if (s <= -0.3) return 'text-red-400'
  if (s >= 0.3) return 'text-green-400'
  return 'text-yellow-400'
}

function sentimentLabel(s: number | null): string {
  if (s === null) return 'N/A'
  if (s <= -0.5) return 'Very Negative'
  if (s <= -0.2) return 'Negative'
  if (s >= 0.5) return 'Very Positive'
  if (s >= 0.2) return 'Positive'
  return 'Neutral'
}

export default function AnalystWorkspace() {
  const [q, setQ] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null)

  const { data: sourcesData } = useDataSources()
  const { data, isLoading } = useDocuments({ q: q || undefined, source_type: sourceType || undefined, page, limit: 20 })

  const selectedDocData = data?.items.find(d => d.id === selectedDoc)

  return (
    <div className="flex h-full">
      {/* Left panel — search + list */}
      <div className="w-96 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border space-y-3">
          <h1 className="text-lg font-bold">Intelligence Workspace</h1>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search intelligence..."
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              className="w-full bg-muted border border-border rounded pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <select
            value={sourceType}
            onChange={e => { setSourceType(e.target.value); setPage(1) }}
            className="w-full bg-muted border border-border rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          >
            <option value="">All source types</option>
            <option value="rss">RSS / News</option>
            <option value="government">Government</option>
            <option value="financial">Financial</option>
          </select>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-auto">
          {isLoading && (
            <div className="p-4 text-muted-foreground text-sm">Loading documents...</div>
          )}
          {data?.items.map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc.id)}
              className={clsx(
                'p-3 border-b border-border cursor-pointer hover:bg-muted/50',
                selectedDoc === doc.id && 'bg-primary/5'
              )}
            >
              <div className="text-sm font-medium line-clamp-2">{doc.title}</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="uppercase">{doc.source_type}</span>
                {doc.published_at && (
                  <span>{format(new Date(doc.published_at), 'MMM d, yyyy')}</span>
                )}
                {doc.sentiment_score !== null && (
                  <span className={sentimentColor(doc.sentiment_score)}>
                    {sentimentLabel(doc.sentiment_score)}
                  </span>
                )}
              </div>
              {doc.entities_mentioned.length > 0 && (
                <div className="mt-1 text-xs text-muted-foreground">
                  {doc.entities_mentioned.length} entity mentions
                </div>
              )}
            </div>
          ))}
          {data?.items.length === 0 && !isLoading && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No documents found. Start the ingestion pipeline to collect intelligence.
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > 20 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{data.total} total</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <span>p.{page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 20 >= data.total}
                className="p-1 hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel — document reader */}
      <div className="flex-1 overflow-auto p-6">
        {selectedDocData ? (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold leading-tight">{selectedDocData.title}</h2>
              <a
                href={selectedDocData.raw_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 shrink-0"
              >
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Source type: <span className="text-foreground uppercase">{selectedDocData.source_type}</span></span>
              {selectedDocData.published_at && (
                <span>Published: <span className="text-foreground">{format(new Date(selectedDocData.published_at), 'PPP')}</span></span>
              )}
              <span>
                Sentiment:{' '}
                <span className={sentimentColor(selectedDocData.sentiment_score)}>
                  {selectedDocData.sentiment_score?.toFixed(3) ?? 'N/A'} ({sentimentLabel(selectedDocData.sentiment_score)})
                </span>
              </span>
              {selectedDocData.relevance_score !== null && (
                <span>Relevance: <span className="text-foreground">{(selectedDocData.relevance_score * 100).toFixed(0)}%</span></span>
              )}
            </div>

            {selectedDocData.entities_mentioned.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-1">Entities mentioned ({selectedDocData.entities_mentioned.length})</div>
                <div className="flex flex-wrap gap-1">
                  {selectedDocData.entities_mentioned.map(eid => (
                    <span key={eid} className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground font-mono">
                      {eid.slice(0, 8)}...
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-border rounded-lg p-4 bg-card text-sm leading-relaxed whitespace-pre-wrap">
              {selectedDocData.body_text || <span className="text-muted-foreground italic">No body text extracted.</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a document to read
          </div>
        )}
      </div>
    </div>
  )
}
