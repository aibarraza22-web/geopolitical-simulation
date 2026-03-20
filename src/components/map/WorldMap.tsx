"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { getRiskColor } from "@/lib/utils";
import { FlashpointMarker } from "./FlashpointMarker";
import { RiskTooltip } from "./RiskTooltip";
import type { RegionRiskData } from "@/types";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO numeric to alpha-2 mapping for common countries
const ISO_NUMERIC_TO_ALPHA2: Record<string, string> = {
  "004": "AF", "008": "AL", "012": "DZ", "024": "AO", "032": "AR",
  "036": "AU", "040": "AT", "050": "BD", "056": "BE", "068": "BO",
  "076": "BR", "100": "BG", "104": "MM", "116": "KH", "120": "CM",
  "124": "CA", "140": "CF", "144": "LK", "152": "CL", "156": "CN",
  "170": "CO", "180": "CD", "188": "CR", "192": "CU", "203": "CZ",
  "208": "DK", "214": "DO", "218": "EC", "818": "EG", "222": "SV",
  "231": "ET", "246": "FI", "250": "FR", "276": "DE", "288": "GH",
  "300": "GR", "320": "GT", "324": "GN", "332": "HT", "340": "HN",
  "348": "HU", "356": "IN", "360": "ID", "364": "IR", "368": "IQ",
  "372": "IE", "376": "IL", "380": "IT", "388": "JM", "392": "JP",
  "400": "JO", "404": "KE", "408": "KP", "410": "KR", "414": "KW",
  "418": "LA", "422": "LB", "430": "LR", "434": "LY", "484": "MX",
  "504": "MA", "508": "MZ", "516": "NA", "524": "NP", "528": "NL",
  "540": "NC", "554": "NZ", "558": "NI", "562": "NE", "566": "NG",
  "578": "NO", "586": "PK", "591": "PA", "598": "PG", "604": "PE",
  "608": "PH", "616": "PL", "620": "PT", "630": "PR", "634": "QA",
  "642": "RO", "643": "RU", "646": "RW", "682": "SA", "686": "SN",
  "694": "SL", "706": "SO", "710": "ZA", "724": "ES", "729": "SD",
  "752": "SE", "756": "CH", "760": "SY", "158": "TW", "764": "TH",
  "768": "TG", "780": "TT", "788": "TN", "792": "TR", "800": "UG",
  "804": "UA", "784": "AE", "826": "GB", "840": "US", "858": "UY",
  "862": "VE", "704": "VN", "887": "YE", "894": "ZM", "716": "ZW",
  "072": "BW", "064": "BT", "204": "BJ", "854": "BF",
  "108": "BI", "132": "CV", "174": "KM", "178": "CG",
  "262": "DJ", "232": "ER", "266": "GA", "270": "GM",
  "624": "GW", "426": "LS", "454": "MW", "466": "ML", "478": "MR",
  "480": "MU", "175": "YT",
  "678": "ST", "748": "SZ",
  "834": "TZ",
};

interface WorldMapProps {
  riskScores?: RegionRiskData[];
  onRegionClick?: (region: RegionRiskData) => void;
  height?: number;
  activeLayers?: string[]; // domain filter: "Military","Financial","Trade","Energy","Political","Humanitarian"
}

interface GeoProperties {
  name?: string;
  NAME?: string;
  [key: string]: unknown;
}

interface GeoFeature {
  rsmKey: string;
  id?: string;
  properties: GeoProperties;
}

const LAYER_DOMAIN_MAP: Record<string, string> = {
  conflict: "military",
  financial: "financial",
  trade: "trade",
  energy: "energy",
};

export function WorldMap({
  riskScores = [],
  onRegionClick,
  height = 420,
  activeLayers,
}: WorldMapProps) {
  const [tooltip, setTooltip] = useState<{
    data: RegionRiskData;
    x: number;
    y: number;
  } | null>(null);

  // Build a lookup map from country code to risk score, filtered by active layers
  const countryRiskMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const region of riskScores) {
      let score = region.risk_score;

      // If specific layers are active, blend their domain component scores
      if (activeLayers && activeLayers.length > 0) {
        const breakdown = (region as RegionRiskData & { composite_breakdown?: Record<string, number> }).composite_breakdown;
        if (breakdown) {
          const domainScores = activeLayers
            .map((l) => LAYER_DOMAIN_MAP[l])
            .filter(Boolean)
            .map((d) => breakdown[d] ?? 0);
          if (domainScores.length > 0) {
            score = Math.round(domainScores.reduce((a, b) => a + b, 0) / domainScores.length);
          }
        }
      }

      for (const code of region.country_codes) {
        map[code] = score;
      }
    }
    return map;
  }, [riskScores, activeLayers]);

  const getCountryFill = useCallback(
    (geo: GeoFeature) => {
      const numericId = geo.id ? String(geo.id).padStart(3, "0") : "";
      const alpha2 = ISO_NUMERIC_TO_ALPHA2[numericId];
      const score = alpha2 ? (countryRiskMap[alpha2] ?? 0) : 0;

      // Spec: 0-30=#00e676, 31-50=#7bc67e, 51-65=#f0a500, 66-80=#ff8c00, 81-100=#ff3b3b, no data=#1a2332
      if (score === 0) return "#1a2332";
      if (score >= 81) return "rgba(255, 59, 59, 0.72)";   // #ff3b3b
      if (score >= 66) return "rgba(255, 140, 0, 0.65)";   // #ff8c00
      if (score >= 51) return "rgba(240, 165, 0, 0.55)";   // #f0a500
      if (score >= 31) return "rgba(123, 198, 126, 0.40)"; // #7bc67e
      return "rgba(0, 230, 118, 0.28)";                    // #00e676 for 1-30
    },
    [countryRiskMap]
  );

  const handleRegionHover = useCallback(
    (region: RegionRiskData | null, x?: number, y?: number) => {
      if (region && x !== undefined && y !== undefined) {
        setTooltip({ data: region, x, y });
      } else {
        setTooltip(null);
      }
    },
    []
  );

  return (
    <div className="relative w-full" style={{ height }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 155, center: [0, 10] }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Ocean background */}
        <rect
          x="-9999"
          y="-9999"
          width="99999"
          height="99999"
          fill="rgba(0, 212, 255, 0.04)"
        />

        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: GeoFeature[] }) =>
            geographies.map((geo) => {
              const numericId = geo.id ? String(geo.id).padStart(3, "0") : "";
              const alpha2 = ISO_NUMERIC_TO_ALPHA2[numericId];
              const score = alpha2 ? (countryRiskMap[alpha2] ?? 0) : 0;
              const fill = getCountryFill(geo);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: {
                      outline: "none",
                      fill: score > 0 ? getRiskColor(score) + "99" : "#253347",
                      stroke: "rgba(255,255,255,0.25)",
                    },
                    pressed: { outline: "none" },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Flashpoint markers — only rendered when we have real data */}
        {riskScores.map((region) => (
          <Marker
            key={region.region}
            coordinates={[region.longitude, region.latitude]}
          >
            <FlashpointMarker
              region={region}
              coordinates={[0, 0]}
              onClick={onRegionClick}
              onHover={handleRegionHover}
            />
          </Marker>
        ))}
      </ComposableMap>

      {/* Tooltip */}
      {tooltip && (
        <RiskTooltip data={tooltip.data} x={tooltip.x} y={tooltip.y} />
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-3 flex items-center gap-3 pointer-events-none bg-axiom-body/60 px-2.5 py-1.5 rounded-sm">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#ff3b3b", opacity: 0.85 }} />
          <span className="text-[9px] font-mono text-white/35">81-100</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#ff8c00", opacity: 0.8 }} />
          <span className="text-[9px] font-mono text-white/35">66-80</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#f0a500", opacity: 0.75 }} />
          <span className="text-[9px] font-mono text-white/35">51-65</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#7bc67e", opacity: 0.65 }} />
          <span className="text-[9px] font-mono text-white/35">31-50</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#00e676", opacity: 0.55 }} />
          <span className="text-[9px] font-mono text-white/35">0-30</span>
        </div>
      </div>
    </div>
  );
}
