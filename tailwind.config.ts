import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        axiom: {
          body: "#080c12",
          panel: "#0d1520",
          border: "rgba(255,255,255,0.07)",
          amber: "#f0a500",
          cyan: "#00d4ff",
          red: "#ff3b3b",
          green: "#00e676",
          "amber-dim": "#b87d00",
          "cyan-dim": "#0099bb",
          "red-dim": "#cc2222",
          "green-dim": "#00aa55",
        },
      },
      fontFamily: {
        display: ["var(--font-bebas)", "Impact", "sans-serif"],
        mono: ["var(--font-share-tech)", "monospace"],
        ui: ["var(--font-barlow)", "sans-serif"],
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-fast": "pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "spin-slow": "spin 3s linear infinite",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-in-left": "slideInLeft 0.3s ease-out forwards",
        "slide-in-right": "slideInRight 0.3s ease-out forwards",
        "glow-amber": "glowAmber 2s ease-in-out infinite alternate",
        "glow-cyan": "glowCyan 2s ease-in-out infinite alternate",
        "scan-line": "scanLine 8s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        glowAmber: {
          "0%": { boxShadow: "0 0 4px rgba(240, 165, 0, 0.3)" },
          "100%": { boxShadow: "0 0 16px rgba(240, 165, 0, 0.7)" },
        },
        glowCyan: {
          "0%": { boxShadow: "0 0 4px rgba(0, 212, 255, 0.3)" },
          "100%": { boxShadow: "0 0 16px rgba(0, 212, 255, 0.7)" },
        },
        scanLine: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
      },
      backgroundImage: {
        "grid-dark":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
    },
  },
  plugins: [],
};

export default config;
