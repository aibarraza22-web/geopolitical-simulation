"use client";

import { motion } from "framer-motion";
import { ExternalLink, MapPin, TrendingDown } from "lucide-react";
import { SeverityBadge, DomainBadge, TagBadge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils";
import type { Signal } from "@/types";

interface SignalItemProps {
  signal: Signal;
  index?: number;
  compact?: boolean;
}

export function SignalItem({ signal, index = 0, compact = false }: SignalItemProps) {
  const hasLink = !!signal.source_url;

  const handleClick = () => {
    if (hasLink) window.open(signal.source_url, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      onClick={handleClick}
      className={`group border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors ${hasLink ? "cursor-pointer" : ""}`}
    >
      <div className={compact ? "px-3 py-2.5" : "px-4 py-3.5"}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <SeverityBadge severity={signal.severity} size={compact ? "sm" : "md"} />
            <DomainBadge domain={signal.domain} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-mono text-white/30">
              {formatRelativeTime(signal.published_at)}
            </span>
            {hasLink && (
              <ExternalLink
                size={11}
                className="text-white/20 group-hover:text-axiom-cyan transition-colors"
              />
            )}
          </div>
        </div>

        {/* Headline */}
        <p
          className={`font-semibold text-white/90 group-hover:text-white transition-colors leading-snug mb-2 font-ui ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {signal.headline}
        </p>

        {!compact && signal.summary && (
          <p className="text-xs text-white/45 leading-relaxed mb-2.5 line-clamp-2">
            {signal.summary}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Source + regions */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono text-axiom-cyan/70">
              {signal.source}
            </span>
            {signal.regions.slice(0, 2).map((region) => (
              <span
                key={region}
                className="inline-flex items-center gap-1 text-[10px] text-white/40"
              >
                <MapPin size={8} />
                {region}
              </span>
            ))}
          </div>

          {/* Asset tags */}
          {!compact && signal.asset_classes.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {signal.asset_classes.slice(0, 3).map((asset) => (
                <TagBadge key={asset}>{asset}</TagBadge>
              ))}
            </div>
          )}

          {/* Sentiment */}
          {!compact && (
            <div className="flex items-center gap-1">
              <TrendingDown
                size={10}
                className={
                  signal.sentiment_score < -0.5
                    ? "text-axiom-red"
                    : signal.sentiment_score < 0
                    ? "text-axiom-amber"
                    : "text-axiom-green"
                }
              />
              <span className="text-[10px] font-mono text-white/30">
                {(signal.sentiment_score * 100).toFixed(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
