"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "Job Pipeline",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><rect x="1" y="10" width="22" height="12" rx="2" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "ProAlly AI",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

interface FetchStatus {
  configured: boolean;
  nextFetchAt: string | null;
  intervalMinutes: number | null;
}

export function Sidebar() {
  const pathname = usePathname();
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null);

  const loadFetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/fetch-status");
      if (res.ok) setFetchStatus(await res.json());
    } catch {
      // Non-critical — the sidebar just falls back to a generic message.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount + polling is intentional
    loadFetchStatus();
    const interval = setInterval(loadFetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [loadFetchStatus]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5 border-b border-[var(--border-subtle)]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="text-base font-bold tracking-tight text-white">ProAlly</span>
        <span className="ml-auto flex h-5 items-center rounded-full bg-violet-500/15 px-2 text-[10px] font-semibold text-violet-400 border border-violet-500/20">
          BETA
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-violet-500/10 text-violet-300 border border-violet-500/15 shadow-[0_0_15px_rgba(139,92,246,0.06)]"
                  : "text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)] border border-transparent"
              }`}
            >
              <span className={`transition-colors ${isActive ? "text-violet-400" : "text-[var(--text-muted)] group-hover:text-white"}`}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Live indicator */}
      <div className="mx-3 mb-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <NextScanLabel status={fetchStatus} />
        </div>
        <p className="mt-1 text-[11px] text-emerald-400/60">
          <ScanCadenceDetail status={fetchStatus} />
        </p>
      </div>

      {/* Sign out */}
      <div className="border-t border-[var(--border-subtle)] p-3">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-secondary)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  );
}

function formatCountdown(targetIso: string): string {
  const diffMs = new Date(targetIso).getTime() - Date.now();
  if (diffMs <= 0) return "any moment now";

  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "any moment now";
  if (mins < 60) return `in ~${mins}m`;

  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `in ~${hrs}h ${remMins}m` : `in ~${hrs}h`;
}

function NextScanLabel({ status }: { status: FetchStatus | null }) {
  if (!status || !status.configured) return <>Job search not yet configured</>;
  if (!status.nextFetchAt) return <>Ready to scan</>;
  return <>Next scan {formatCountdown(status.nextFetchAt)}</>;
}

function ScanCadenceDetail({ status }: { status: FetchStatus | null }) {
  if (!status || !status.configured) {
    return <>An admin needs to add a JSearch key in Settings.</>;
  }
  if (!status.intervalMinutes) {
    return <>Cadence will be set after the first scan.</>;
  }

  const hrs = status.intervalMinutes / 60;
  const cadence = hrs >= 1 ? `~${Math.round(hrs * 10) / 10}h` : `~${status.intervalMinutes}m`;
  const perDay = Math.max(1, Math.round(1440 / status.intervalMinutes));

  return (
    <>
      Checking LinkedIn &amp; Indeed every {cadence} (~{perDay}×/day) to stay within the key&apos;s quota
    </>
  );
}
