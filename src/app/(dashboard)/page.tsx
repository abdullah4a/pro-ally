"use client";

import { useEffect, useState, useCallback, type MouseEvent } from "react";
import { CvUploader } from "@/components/cv-uploader";
import { JobDescription, PlatformChip, Skeleton } from "@/components/ui";

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
  notes: string;
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  new: {
    label: "New",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    icon: "✦",
  },
  saved: {
    label: "Saved",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    icon: "★",
  },
  applied: {
    label: "Applied",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: "→",
  },
  interviewing: {
    label: "Interviewing",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: "◉",
  },
  offer: {
    label: "Offer",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: "✓",
  },
  rejected: {
    label: "Rejected",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    icon: "✕",
  },
};

const ALL_STATUSES: JobStatus[] = ["new", "saved", "applied", "interviewing", "offer", "rejected"];

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<JobStatus | "all">("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  // Which job just had its Apply link opened and is awaiting the "did you
  // apply?" confirmation — at most one at a time, matching the one-tab-at-a-
  // time reality of actually clicking through to an application.
  const [pendingApplyId, setPendingApplyId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        setLastFetched(new Date());
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
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchJobs, 60_000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const updateJobStatus = async (jobId: string, status: JobStatus) => {
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, status }),
    });
    setJobs((prev) =>
      prev.map((j) => (j._id === jobId ? { ...j, status } : j))
    );
    if (selectedJob?._id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, status } : null));
    }
  };

  // Applying and saving are common enough to deserve one-click buttons right on
  // the card; other transitions stay in the detail panel's full status picker.
  const saveJob = (e: MouseEvent, jobId: string) => {
    e.stopPropagation();
    updateJobStatus(jobId, "saved");
  };

  // Opening the link only means the user was *sent* to apply, not that they
  // did — the follow-up prompt (confirmApplied/dismissApplyConfirm) is what
  // actually resolves whether the click became a real application.
  const applyToJob = (e: MouseEvent, job: Job) => {
    e.stopPropagation();
    window.open(job.url, "_blank", "noopener,noreferrer");
    setPendingApplyId(job._id);
    fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job._id, action: "apply_clicked" }),
    }).catch(() => {
      // Non-critical — the confirmation prompt still works even if this log fails.
    });
  };

  const confirmApplied = async (jobId: string) => {
    setPendingApplyId(null);
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "applied_confirmed" }),
    });
    setJobs((prev) => prev.map((j) => (j._id === jobId ? { ...j, status: "applied" } : j)));
    if (selectedJob?._id === jobId) {
      setSelectedJob((prev) => (prev ? { ...prev, status: "applied" } : null));
    }
  };

  const dismissApplyConfirm = (jobId: string) => {
    setPendingApplyId(null);
    fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, action: "not_applied_yet" }),
    }).catch(() => {
      // Non-critical — dismissing the prompt should never feel blocked on the network.
    });
  };

  // Stats
  const stats = {
    total: jobs.length,
    new: jobs.filter((j) => j.status === "new").length,
    applied: jobs.filter((j) => j.status === "applied").length,
    interviewing: jobs.filter((j) => j.status === "interviewing").length,
    offers: jobs.filter((j) => j.status === "offer").length,
    avgMatch: jobs.length > 0 ? Math.round(jobs.reduce((a, b) => a + b.matchScore, 0) / jobs.length) : 0,
  };

  const filteredJobs = activeFilter === "all" ? jobs : jobs.filter((j) => j.status === activeFilter);

  const timeAgo = (dateStr: string) => {
    // eslint-disable-next-line react-hooks/purity -- display-only relative time, not used for logic
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {lastFetched
              ? `Last synced ${timeAgo(lastFetched.toISOString())}`
              : "Syncing..."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCvModal(true)}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
            Upload CV
          </button>
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 hover:brightness-110"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Jobs" value={stats.total} icon="📊" accentColor="violet" />
            <StatCard label="New" value={stats.new} icon="✦" accentColor="cyan" />
            <StatCard label="Applied" value={stats.applied} icon="→" accentColor="blue" />
            <StatCard label="Interviewing" value={stats.interviewing} icon="◉" accentColor="amber" />
            <StatCard label="Offers" value={stats.offers} icon="✓" accentColor="emerald" />
            <StatCard label="Avg Match" value={`${stats.avgMatch}%`} icon="⚡" accentColor="rose" />
          </>
        )}
      </div>

      {/* Filter Tabs */}
      {loading ? (
        <FilterTabsSkeleton />
      ) : (
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1.5">
          <FilterTab
            label="All"
            count={jobs.length}
            active={activeFilter === "all"}
            onClick={() => setActiveFilter("all")}
          />
          {ALL_STATUSES.map((s) => (
            <FilterTab
              key={s}
              label={STATUS_CONFIG[s].label}
              count={jobs.filter((j) => j.status === s).length}
              active={activeFilter === s}
              onClick={() => setActiveFilter(s)}
            />
          ))}
        </div>
      )}

      {/* Job Grid */}
      <div className="grid gap-4">
        {loading ? (
          <>
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] py-20 text-center">
            <div className="mb-4 text-4xl">🔍</div>
            <p className="text-lg font-medium text-[var(--text-secondary)]">
              {activeFilter === "all" ? "No jobs found yet" : `No ${activeFilter} jobs`}
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {activeFilter === "all"
                ? "Upload your CV and ProAlly will start finding matches within 5 minutes."
                : "Move jobs here by changing their status."}
            </p>
          </div>
        ) : (
          filteredJobs.map((job, idx) => (
            <div
              key={job._id}
              onClick={() => setSelectedJob(job)}
              className="group cursor-pointer rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 transition-all duration-200 hover:border-[var(--border-accent)] hover:bg-[var(--bg-elevated)] hover:shadow-[var(--shadow-glow)]"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-base font-semibold text-white group-hover:text-violet-300 transition-colors">
                      {job.title}
                    </h3>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${STATUS_CONFIG[job.status].bg} ${STATUS_CONFIG[job.status].color} ${STATUS_CONFIG[job.status].border}`}>
                      {STATUS_CONFIG[job.status].icon} {STATUS_CONFIG[job.status].label}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-muted)]">
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
                      {job.company}
                    </span>
                    <PlatformChip source={job.source} publisher={job.publisher} />
                    <span>·</span>
                    <span>{timeAgo(job.postedAt)}</span>
                  </div>
                  {job.description && (
                    <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {job.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-3">
                  <div className={`flex flex-col items-center justify-center rounded-lg px-3 py-1.5 ${
                    job.matchScore >= 85
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : job.matchScore >= 70
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}>
                    <span className="text-sm font-bold leading-none">{job.matchScore}%</span>
                    <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-80">Match</span>
                  </div>
                </div>
              </div>

              {/* Actions — always visible, not hover-only, so they're discoverable on touch devices too */}
              {pendingApplyId === job._id ? (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-3"
                >
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Did you apply to this job?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => confirmApplied(job._id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition hover:scale-[1.02] ${STATUS_CONFIG.applied.bg} ${STATUS_CONFIG.applied.border} ${STATUS_CONFIG.applied.color}`}
                    >
                      {STATUS_CONFIG.applied.icon} Yes, mark Applied
                    </button>
                    <button
                      onClick={() => dismissApplyConfirm(job._id)}
                      className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-white"
                    >
                      Not yet
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--border-subtle)] pt-3">
                  <button
                    onClick={(e) => applyToJob(e, job)}
                    className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-violet-500/30 hover:brightness-110"
                  >
                    Apply
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </button>
                  {job.status !== "saved" && (
                    <button
                      onClick={(e) => saveJob(e, job._id)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:scale-[1.02] ${STATUS_CONFIG.saved.bg} ${STATUS_CONFIG.saved.border} ${STATUS_CONFIG.saved.color}`}
                    >
                      {STATUS_CONFIG.saved.icon} Save
                    </button>
                  )}
                  {job.status !== "interviewing" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateJobStatus(job._id, "interviewing");
                      }}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:scale-[1.02] ${STATUS_CONFIG.interviewing.bg} ${STATUS_CONFIG.interviewing.border} ${STATUS_CONFIG.interviewing.color}`}
                    >
                      {STATUS_CONFIG.interviewing.icon} Mark Interviewing
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Job Detail Slide-over */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedJob(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-3xl animate-slide-in overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedJob.title}</h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-[var(--text-muted)]">
                  <span>{selectedJob.company}</span>
                  <PlatformChip source={selectedJob.source} publisher={selectedJob.publisher} />
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Match score */}
            <div className="mt-6 flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold ${
                selectedJob.matchScore >= 85
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                {selectedJob.matchScore}%
              </div>
              <div>
                <p className="text-sm font-medium text-white">Match Score</p>
                <p className="text-xs text-[var(--text-muted)]">Based on your CV skills</p>
              </div>
            </div>

            {/* Status selector */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateJobStatus(selectedJob._id, s)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold border transition-all ${
                      selectedJob.status === s
                        ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border} ring-1 ring-offset-1 ring-offset-[var(--bg-secondary)]`
                        : "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white"
                    }`}
                  >
                    <span>{STATUS_CONFIG[s].icon}</span>
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Description
              </p>
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
                <JobDescription text={selectedJob.description} />
              </div>
            </div>

            {/* Actions */}
            {pendingApplyId === selectedJob._id ? (
              <div className="mt-6 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="mb-3 text-sm font-medium text-white">Did you apply to this job?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => confirmApplied(selectedJob._id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-semibold transition hover:scale-[1.01] ${STATUS_CONFIG.applied.bg} ${STATUS_CONFIG.applied.border} ${STATUS_CONFIG.applied.color}`}
                  >
                    {STATUS_CONFIG.applied.icon} Yes, mark Applied
                  </button>
                  <button
                    onClick={() => dismissApplyConfirm(selectedJob._id)}
                    className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-white"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex gap-3">
                <button
                  onClick={(e) => applyToJob(e, selectedJob)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:shadow-violet-500/30 hover:brightness-110"
                >
                  View & Apply
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
                <button
                  onClick={() => updateJobStatus(selectedJob._id, "rejected")}
                  className="flex items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm font-medium text-rose-400 transition hover:bg-rose-500/10"
                >
                  Reject
                </button>
              </div>
            )}

            {/* Meta info */}
            <div className="mt-6 space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Posted</span>
                <span className="text-[var(--text-secondary)]">{timeAgo(selectedJob.postedAt)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-muted)]">Source</span>
                <PlatformChip source={selectedJob.source} publisher={selectedJob.publisher} />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[var(--text-muted)]">Added to ProAlly</span>
                <span className="text-[var(--text-secondary)]">{timeAgo(selectedJob.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CV Upload Modal */}
      {showCvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowCvModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md animate-fade-in rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Upload Your CV</h2>
              <button
                onClick={() => setShowCvModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              Upload your CV and ProAlly will parse your skills to find the best matching jobs automatically.
            </p>
            <CvUploader onUploaded={() => setShowCvModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ label, value, icon, accentColor }: { label: string; value: number | string; icon: string; accentColor: string }) {
  const colorMap: Record<string, string> = {
    violet: "from-violet-500/10 to-violet-500/5 border-violet-500/10 text-violet-400",
    cyan: "from-cyan-500/10 to-cyan-500/5 border-cyan-500/10 text-cyan-400",
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/10 text-blue-400",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/10 text-amber-400",
    emerald: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/10 text-emerald-400",
    rose: "from-rose-500/10 to-rose-500/5 border-rose-500/10 text-rose-400",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${colorMap[accentColor]}`}>
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{label}</p>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <Skeleton className="h-5 w-5" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-6 w-10" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

function FilterTabsSkeleton() {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-20" />
      ))}
    </div>
  );
}

function JobCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-4 w-2/5" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <Skeleton className="h-12 w-14 shrink-0" />
      </div>
      <div className="mt-4 flex gap-2 border-t border-[var(--border-subtle)] pt-3">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  );
}

function FilterTab({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
        active
          ? "bg-violet-500/15 text-violet-300 shadow-sm"
          : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      }`}
    >
      {label}
      <span className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
        active ? "bg-violet-500/20 text-violet-300" : "bg-[var(--bg-card)] text-[var(--text-dim)]"
      }`}>
        {count}
      </span>
    </button>
  );
}
