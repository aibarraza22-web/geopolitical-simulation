"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Globe,
  Zap,
  Briefcase,
  Eye,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/predict",
    label: "Predict",
    icon: Brain,
    accent: true,
  },
  {
    href: "/map",
    label: "Risk Map",
    icon: Globe,
  },
  {
    href: "/simulate",
    label: "Simulate",
    icon: Zap,
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: Briefcase,
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: Eye,
  },
  {
    href: "/research",
    label: "Research",
    icon: Search,
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    separator: true,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="relative flex flex-col h-screen bg-axiom-panel border-r border-white/[0.07] shrink-0 overflow-hidden z-10"
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-white/[0.07] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-sm bg-axiom-amber shrink-0">
            <Activity size={14} className="text-black" strokeWidth={3} />
          </div>
          <motion.span
            animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
            transition={{ duration: 0.15 }}
            className="font-display text-xl tracking-widest text-white overflow-hidden whitespace-nowrap"
          >
            AXIOM
          </motion.span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                {item.separator && (
                  <div className="my-2 border-t border-white/[0.07]" />
                )}
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-2 py-2 rounded-[3px] transition-all duration-150 group relative",
                    active
                      ? "bg-axiom-amber/15 text-axiom-amber"
                      : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
                    item.accent && !active && "text-axiom-amber/70"
                  )}
                >
                  {/* Active indicator */}
                  {active && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute left-0 top-1 bottom-1 w-[2px] bg-axiom-amber rounded-full"
                    />
                  )}
                  <Icon
                    size={16}
                    strokeWidth={active ? 2 : 1.5}
                    className="shrink-0"
                  />
                  <motion.span
                    animate={{
                      opacity: collapsed ? 0 : 1,
                      width: collapsed ? 0 : "auto",
                    }}
                    transition={{ duration: 0.15 }}
                    className="text-xs font-semibold uppercase tracking-wider font-ui whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Version tag */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/[0.07]">
          <p className="text-[10px] font-mono text-white/20 tracking-widest">
            AXIOM v1.0.0
          </p>
          <p className="text-[10px] font-mono text-white/20">
            CLASSIFICATION: RESTRICTED
          </p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-3 right-2 p-1 rounded-sm text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
}
