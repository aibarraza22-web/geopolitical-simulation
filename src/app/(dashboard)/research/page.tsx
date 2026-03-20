"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, ExternalLink, Loader2, BookOpen, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { DomainBadge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { ResearchDocument } from "@/types";

const SAMPLE_QUERIES = [
  "Taiwan Strait military balance semiconductor risk",
  "Iran nuclear breakout timeline",
  "European energy security post-Russia",
  "Sahel security Wagner expansion",
  "North Korea ICBM capabilities",
];

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResearchDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  // Load all documents on mount
  useEffect(() => {
    const loadAll = async () => {
      setIsSearching(true);
      try {
        const res = await fetch("/api/research/list");
        if (res.ok) {
          const json = (await res.json()) as { data?: ResearchDocument[] };
          setResults(json.data ?? []);
          setHasSearched(true);
        }
      } catch {
        // Silently fail — user can still search
      } finally {
        setIsSearching(false);
      }
    };
    void loadAll();
  }, []);

  const handleSearch = async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q || q.length < 2) return;

    setIsSearching(true);
    setHasSearched(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/research/search?q=${encodeURIComponent(q)}`);
      const json = (await res.json()) as { data?: ResearchDocument[]; error?: string };

      if (!res.ok || json.error) {
        setSearchError(json.error ?? "Search failed");
        setResults([]);
      } else {
        setResults(json.data ?? []);
      }
    } catch {
      setSearchError("Network error — could not reach search API.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleClearSearch = () => {
    setQuery("");
    setSearchError(null);
    void fetch("/api/research/list")
      .then((r) => r.json())
      .then((json: { data?: ResearchDocument[] }) => setResults(json.data ?? []));
  };

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch("/api/research/ingest", { method: "POST" });
      const json = await res.json() as { ingested?: number; total_fetched?: number; feeds?: number; error?: string };
      if (json.error) {
        setIngestMsg(`Error: ${json.error}`);
      } else {
        setIngestMsg(`Added ${json.ingested ?? 0} new documents from ${json.feeds ?? 0} sources`);
        // Reload corpus
        const listRes = await fetch("/api/research/list");
        const listJson = await listRes.json() as { data?: ResearchDocument[] };
        setResults(listJson.data ?? []);
        setHasSearched(true);
      }
    } catch {
      setIngestMsg("Failed to refresh corpus");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="p-5 space-y-5">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-widest text-white">RESEARCH CORPUS</h1>
          <p className="text-xs text-white/40 mt-0.5 font-mono">
            Intelligence reports, think-tank analysis, and geopolitical research · {results.length} documents
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={12} className={ingesting ? "animate-spin" : ""} />}
            onClick={handleIngest}
            loading={ingesting}
          >
            {ingesting ? "Syncing..." : "Sync Think Tanks"}
          </Button>
          {ingestMsg && (
            <p className="text-[10px] font-mono text-axiom-cyan/70">{ingestMsg}</p>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <div className="flex items-center gap-3">
            <Search size={16} className="text-white/30 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search intelligence corpus..."
              className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 outline-none font-ui"
            />
            {query && (
              <button onClick={handleClearSearch} className="text-[10px] font-mono text-white/30 hover:text-white/60">
                Clear
              </button>
            )}
            <Button variant="primary" size="sm" onClick={() => handleSearch()} loading={isSearching} disabled={query.trim().length < 2}>
              Search
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-white/25">Try:</span>
            {SAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-[10px] text-axiom-cyan/60 hover:text-axiom-cyan border border-axiom-cyan/20 hover:border-axiom-cyan/40 px-2 py-0.5 rounded-[2px] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      <AnimatePresence mode="wait">
        {isSearching && (
          <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={24} className="text-axiom-amber animate-spin" />
              <p className="text-xs font-mono text-white/40">Loading corpus...</p>
            </div>
          </motion.div>
        )}

        {!isSearching && searchError && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState icon={<Search size={20} />} title="Search error" description={searchError} />
          </motion.div>
        )}

        {!isSearching && !searchError && results.length === 0 && hasSearched && (
          <motion.div key="no-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState
              icon={<BookOpen size={20} />}
              title="No documents found"
              description='No results found. Try a different query or click "Clear" to browse all documents.'
            />
          </motion.div>
        )}

        {!isSearching && !searchError && results.length > 0 && (
          <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-[11px] font-mono text-white/35">
              {hasSearched && query ? `${results.length} results for "${query}"` : `${results.length} documents in corpus`}
            </p>
            {results.map((doc, i) => (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card hoverable>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-sm bg-axiom-amber/10 border border-axiom-amber/20 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText size={13} className="text-axiom-amber" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <h3 className="text-sm font-semibold text-white/90">{doc.title}</h3>
                        {doc.source && (
                          <Button variant="ghost" size="xs" icon={<ExternalLink size={10} />} iconPosition="right">
                            View
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-white/50 leading-relaxed line-clamp-3 mb-2">{doc.content}</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[10px] font-mono text-axiom-cyan/60">{doc.source}</span>
                        <span className="text-[10px] font-mono text-white/25">{formatDate(doc.published_at)}</span>
                        <span className="text-[10px] font-mono text-white/30 capitalize bg-white/[0.04] px-1.5 py-0.5 rounded-[2px]">
                          {doc.document_type}
                        </span>
                        {doc.domains?.map((domain) => <DomainBadge key={domain} domain={domain} />)}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
