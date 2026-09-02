"use client";

import { useEffect, useState, useCallback, type MouseEvent } from "react";

import { PlatformChip, Skeleton } from "@/components/ui";

type JobStatus = "new" | "saved" | "applied" | "interviewing" | "offer" | "rejected";

interface Job {
  _id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  publisher: string | null;
  matchScore: number;
  status: JobStatus;
  postedAt: string;
  createdAt: string;
}

const COLUMNS: { status: JobStatus; label: string; color: string; borderColor: string }[] = [
  { status: "new", label: "New", color: "text-cyan-400", borderColor: "border-t-cyan-500" },
  { status: "saved", label: "Saved", color: "text-violet-400", borderColor: "border-t-violet-500" },
  { status: "applied", label: "Applied", color: "text-blue-400", borderColor: "border-t-blue-500" },
  { status: "interviewing", label: "Interviewing", color: "text-amber-400", borderColor: "border-t-amber-500" },
  { status: "offer", label: "Offer", color: "text-emerald-400", borderColor: "border-t-emerald-500" },
  { status: "rejected", label: "Rejected", color: "text-rose-400", borderColor: "border-t-rose-500" },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount + polling is intentional
    fetchJobs();
    const interval = setInterval(fetchJobs, 60_000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const updateStatus = async (jobId: string, newStatus: JobStatus) => {
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status: newStatus }),
    });
    setJobs((prev) =>
      prev.map((j) => (j._id === jobId ? { ...j, status: newStatus } : j))
    );
  };

  // Opening the link only means the user was *sent* to apply, not that they
  // did — the follow-up prompt is what actually resolves whether the click
  // became a real application. See dashboard page.tsx for the same pattern.
  const applyToJob = (e: MouseEvent, job: Job) => {
    e.stopPropagation();
    window.open(job.url, "_blank", "noopener,noreferrer");
    setPendingApplyId(job._id);
    fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job._id, action: "apply_clicked" }),
    }).catch(() => {});
  };

  const confirmApplied = async (jobId: string) => {
    setPendingApplyId(null);
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "applied_confirmed" }),
    });
    setJobs((prev) => prev.map((j) => (j._id === jobId ? { ...j, status: "applied" } : j)));
  };

  const dismissApplyConfirm = (jobId: string) => {
    setPendingApplyId(null);
    fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "not_applied_yet" }),
    }).catch(() => {});
  };

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity -- display-only relative time, not used for logic
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Pipeline</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {loading ? "Loading your pipeline…" : `Drag-and-drop style board • ${jobs.length} total jobs`}
          </p>
        </div>
        <button
          onClick={fetchJobs}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 hover:brightness-110"
        >
          Refresh
        </button>
      </div>

      {/* Kanban board */}
      {loading ? (
        <KanbanSkeleton />
      ) : (
      <div className="grid grid-cols-6 gap-3" style={{ minHeight: "70vh" }}>
        {COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => j.status === col.status);
          return (
            <div
              key={col.status}
              className={`flex flex-col rounded-xl border border-[var(--border-subtle)] border-t-2 ${col.borderColor} bg-[var(--bg-secondary)]`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                </div>
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--bg-card)] px-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
                  {colJobs.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {colJobs.map((job) => (
                  <div
                    key={job._id}
                    className="group rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 transition hover:border-[var(--border-accent)] hover:shadow-[var(--shadow-glow)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-semibold text-white leading-tight line-clamp-2">
                        {job.title}
                      </h4>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        job.matchScore >= 85 ? "bg-emerald-500/10 text-emerald-400" : job.matchScore >= 70 ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {job.matchScore}%
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">{job.company}</p>

                    {job.description && (
                      <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {job.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center justify-between gap-1">
                      <PlatformChip source={job.source} publisher={job.publisher} className="px-1.5 py-0.5 text-[10px]" />
                      <span className="text-[10px] text-[var(--text-dim)]">{timeAgo(job.postedAt)}</span>
                    </div>

                    {pendingApplyId === job._id ? (
                      <div className="mt-2 rounded-md border border-violet-500/20 bg-violet-500/5 p-1.5">
                        <p className="mb-1 text-center text-[10px] text-[var(--text-secondary)]">
                          Applied?
                        </p>
                        <div className="flex gap-1">
                          <button
                            onClick={() => confirmApplied(job._id)}
                            className="flex-1 rounded bg-blue-500/15 py-1 text-[10px] font-semibold text-blue-400 transition hover:scale-105"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => dismissApplyConfirm(job._id)}
                            className="flex-1 rounded border border-[var(--border-default)] bg-[var(--bg-elevated)] py-1 text-[10px] font-medium text-[var(--text-secondary)] transition hover:scale-105"
                          >
                            Not yet
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => applyToJob(e, job)}
                        className="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-gradient-to-r from-violet-600 to-cyan-600 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110"
                      >
                        Apply
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </button>
                    )}

                    {/* Quick move buttons */}
                    <div className="mt-2 flex flex-wrap gap-1 opacity-0 transition group-hover:opacity-100">
                      {COLUMNS.filter((c) => c.status !== col.status)
                        .slice(0, 3)
                        .map((target) => (
                          <button
                            key={target.status}
                            onClick={() => updateStatus(job._id, target.status)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium border transition hover:scale-105 ${target.color} border-[var(--border-default)] bg-[var(--bg-elevated)]`}
                          >
                            → {target.label}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-3" style={{ minHeight: "70vh" }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]"
        >
          <div className="flex items-center justify-between px-3 py-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
          <div className="flex-1 space-y-2 px-2 pb-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5"
              >
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
