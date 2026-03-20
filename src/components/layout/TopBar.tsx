"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, User, LogOut, Settings } from "lucide-react";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { cn } from "@/lib/utils";

const routeLabels: Record<string, string> = {
  "/": "Overview",
  "/map": "Risk Map",
  "/simulate": "Scenario Simulator",
  "/portfolio": "Portfolio Exposure",
  "/watchlist": "Watchlist",
  "/research": "Research Corpus",
  "/admin": "Administration",
};

const mockNotifications = [
  {
    id: "n1",
    type: "alert" as const,
    title: "Taiwan Strait Alert",
    body: "Risk score exceeded 85 threshold",
    time: "2m ago",
    unread: true,
  },
  {
    id: "n2",
    type: "signal" as const,
    title: "Critical Signal",
    body: "PLA Naval Drills Encircle Taiwan",
    time: "25m ago",
    unread: true,
  },
  {
    id: "n3",
    type: "simulation" as const,
    title: "Simulation Complete",
    body: "Iran Nuclear Breakout analysis ready",
    time: "2h ago",
    unread: false,
  },
];

export function TopBar() {
  const pathname = usePathname();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const unreadCount = mockNotifications.filter((n) => n.unread).length;

  const pageLabel = routeLabels[pathname] ?? "AXIOM";

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-white/[0.07] bg-axiom-panel/80 backdrop-blur-sm shrink-0 relative z-20">
      {/* Left: Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-ui">
        <span className="text-white/30 tracking-wider uppercase">AXIOM</span>
        <ChevronRight size={12} className="text-white/20" />
        <span className="text-white/70 tracking-wider uppercase font-semibold">
          {pageLabel}
        </span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <LiveIndicator />

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="relative p-1.5 rounded-sm text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 text-[8px] font-bold bg-axiom-red text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-axiom-panel border border-white/[0.10] rounded-sm shadow-xl z-50">
              <div className="px-3 py-2 border-b border-white/[0.07] flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Notifications
                </span>
                <span className="text-[10px] font-mono text-axiom-amber">
                  {unreadCount} unread
                </span>
              </div>
              <div className="divide-y divide-white/[0.05] max-h-64 overflow-y-auto">
                {mockNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn(
                      "px-3 py-2.5 hover:bg-white/[0.03] cursor-pointer",
                      n.unread && "bg-axiom-amber/[0.03]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-white/45 mt-0.5 line-clamp-1">
                          {n.body}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-white/30">
                          {n.time}
                        </span>
                        {n.unread && (
                          <div className="w-1.5 h-1.5 rounded-full bg-axiom-amber" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2 border-t border-white/[0.07]">
                <button className="text-[10px] font-semibold uppercase tracking-wider text-axiom-cyan hover:text-axiom-cyan/80 transition-colors">
                  View all alerts →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-axiom-amber/20 border border-axiom-amber/40 flex items-center justify-center">
              <User size={12} className="text-axiom-amber" />
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[11px] font-semibold text-white/80 leading-none">
                Demo Analyst
              </p>
              <p className="text-[10px] text-white/40 mt-0.5 leading-none">
                Professional
              </p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-44 bg-axiom-panel border border-white/[0.10] rounded-sm shadow-xl z-50 overflow-hidden">
              <div className="px-3 py-2 border-b border-white/[0.07]">
                <p className="text-[10px] text-white/40 truncate">
                  demo@axiom.io
                </p>
              </div>
              <div className="py-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors">
                  <Settings size={12} />
                  <span>Settings</span>
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-xs text-axiom-red/80 hover:text-axiom-red hover:bg-axiom-red/[0.05] transition-colors">
                  <LogOut size={12} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-away overlay */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}
    </header>
  );
}
