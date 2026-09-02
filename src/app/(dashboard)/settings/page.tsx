"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { CvUploader } from "@/components/cv-uploader";
import { Badge, Button, Card, Input, Label, Pill, Select, Skeleton, Toggle } from "@/components/ui";

type JobType = "full-time" | "remote" | "contract" | "freelance";
type ExperienceLevel = "junior" | "mid" | "senior" | "lead";
type Platform = "linkedin" | "indeed" | "upwork" | "fiverr" | "ats";

const JOB_TYPES: JobType[] = ["full-time", "remote", "contract", "freelance"];
const EXPERIENCE_LEVELS: ExperienceLevel[] = ["junior", "mid", "senior", "lead"];
const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "upwork", label: "Upwork" },
  { value: "fiverr", label: "Fiverr" },
  { value: "ats", label: "Company ATS" },
];

interface Profile {
  fullName: string;
  preferredCountry: string;
  preferredCities: string[];
  jobTypes: JobType[];
  minSalary?: number;
  remoteOnly: boolean;
  experienceLevel?: ExperienceLevel;
}

interface Filters {
  keywords: string[];
  excludeKeywords: string[];
  platforms: Platform[];
  minTrustScore: number;
  minMatchScore: number;
  pollIntervalMins: number;
}

interface Cv {
  id: string;
  fileName: string;
  uploadedAt: string;
  parsingIncomplete?: boolean;
  parsed: {
    skills: string[];
    experienceYears: number;
    jobTitles: string[];
  };
}

type JsearchKeyStatus = "unknown" | "ok" | "quota_exceeded" | "invalid" | "error";

interface JsearchKey {
  id: string;
  label: string;
  keyPreview: string;
  isActive: boolean;
  status: JsearchKeyStatus;
  statusMessage: string | null;
  lastCheckedAt: string | null;
  monthlyLimit: number | null;
  requestsRemainingKnown: number | null;
  lastFetchedAt: string | null;
  fetchIntervalMinutes: number | null;
  createdAt: string;
}

const EMPTY_PROFILE: Profile = {
  fullName: "",
  preferredCountry: "",
  preferredCities: [],
  jobTypes: [],
  remoteOnly: false,
};

const EMPTY_FILTERS: Filters = {
  keywords: [],
  excludeKeywords: [],
  platforms: ["linkedin", "indeed", "upwork"],
  minTrustScore: 60,
  minMatchScore: 70,
  pollIntervalMins: 15,
};

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cv, setCv] = useState<Cv | null>(null);
  const [showCvModal, setShowCvModal] = useState(false);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [citiesInput, setCitiesInput] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [keywordsInput, setKeywordsInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [filtersSaving, setFiltersSaving] = useState(false);
  const [filtersMessage, setFiltersMessage] = useState<string | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [jsearchKeys, setJsearchKeys] = useState<JsearchKey[]>([]);
  const [jsearchUsingEnvFallback, setJsearchUsingEnvFallback] = useState(false);
  const [jsearchKeyInput, setJsearchKeyInput] = useState("");
  const [jsearchLabelInput, setJsearchLabelInput] = useState("");
  const [jsearchAdding, setJsearchAdding] = useState(false);
  const [jsearchBusyId, setJsearchBusyId] = useState<string | null>(null);
  const [jsearchTestingId, setJsearchTestingId] = useState<string | null>(null);
  const [jsearchMessage, setJsearchMessage] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/me");
      const data = await res.json();

      if (!res.ok) {
        setLoadError(
          typeof data.error === "string"
            ? data.error
            : "We couldn't load your account right now. Please try again in a moment.",
        );
        return;
      }

      if (data.profile) {
        setProfile({
          fullName: data.profile.fullName ?? "",
          preferredCountry: data.profile.preferredCountry ?? "",
          preferredCities: data.profile.preferredCities ?? [],
          jobTypes: data.profile.jobTypes ?? [],
          minSalary: data.profile.minSalary,
          remoteOnly: data.profile.remoteOnly ?? false,
          experienceLevel: data.profile.experienceLevel,
        });
        setCitiesInput((data.profile.preferredCities ?? []).join(", "));
      }

      if (data.filters) {
        setFilters({
          keywords: data.filters.keywords ?? [],
          excludeKeywords: data.filters.excludeKeywords ?? [],
          platforms: data.filters.platforms ?? EMPTY_FILTERS.platforms,
          minTrustScore: data.filters.minTrustScore ?? 60,
          minMatchScore: data.filters.minMatchScore ?? 70,
          pollIntervalMins: data.filters.pollIntervalMins ?? 15,
        });
        setKeywordsInput((data.filters.keywords ?? []).join(", "));
        setExcludeInput((data.filters.excludeKeywords ?? []).join(", "));
      }

      setCv(data.cv);
    } catch {
      setLoadError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional
    loadMe();
  }, [loadMe]);

  const loadJsearchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jsearch-keys");
      if (!res.ok) {
        // 403 for non-admins is expected — this section just stays hidden.
        setIsAdmin(false);
        return;
      }
      const data = await res.json();
      setIsAdmin(true);
      setJsearchKeys(data.keys);
      setJsearchUsingEnvFallback(data.usingEnvFallback);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount is intentional
    loadJsearchKeys();
  }, [loadJsearchKeys]);

  async function addJsearchKey() {
    if (!jsearchKeyInput.trim()) return;
    setJsearchAdding(true);
    setJsearchMessage(null);

    try {
      const res = await fetch("/api/admin/jsearch-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: jsearchKeyInput.trim(),
          label: jsearchLabelInput.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setJsearchMessage(
          typeof data.error === "string" ? data.error : "We couldn't save this key. Please try again.",
        );
        return;
      }

      setJsearchMessage(data.message);
      setJsearchKeyInput("");
      setJsearchLabelInput("");
      await loadJsearchKeys();
    } catch {
      setJsearchMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setJsearchAdding(false);
    }
  }

  async function setJsearchKeyActive(id: string, active: boolean) {
    setJsearchBusyId(id);
    setJsearchMessage(null);

    try {
      const res = await fetch(`/api/admin/jsearch-keys/${id}/${active ? "activate" : "deactivate"}`, {
        method: "POST",
      });
      const data = await res.json();

      setJsearchMessage(
        res.ok
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : `We couldn't ${active ? "activate" : "deactivate"} this key. Please try again.`,
      );
      if (res.ok) await loadJsearchKeys();
    } catch {
      setJsearchMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setJsearchBusyId(null);
    }
  }

  async function deleteJsearchKey(id: string, label: string) {
    if (!window.confirm(`Delete "${label}"? This can't be undone.`)) return;
    setJsearchBusyId(id);
    setJsearchMessage(null);

    try {
      const res = await fetch(`/api/admin/jsearch-keys/${id}`, { method: "DELETE" });
      const data = await res.json();

      setJsearchMessage(
        res.ok
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "We couldn't delete this key. Please try again.",
      );
      if (res.ok) await loadJsearchKeys();
    } catch {
      setJsearchMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setJsearchBusyId(null);
    }
  }

  async function testJsearchKey(id: string) {
    setJsearchTestingId(id);
    setJsearchMessage(null);

    try {
      const res = await fetch(`/api/admin/jsearch-keys/${id}/test`, { method: "POST" });
      const data = await res.json();

      setJsearchMessage(
        res.ok
          ? data.message
          : typeof data.error === "string"
            ? data.error
            : "We couldn't test this key. Please try again.",
      );
      await loadJsearchKeys();
    } catch {
      setJsearchMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setJsearchTestingId(null);
    }
  }

  function toggleJobType(type: JobType) {
    setProfile((prev) => ({
      ...prev,
      jobTypes: prev.jobTypes.includes(type)
        ? prev.jobTypes.filter((t) => t !== type)
        : [...prev.jobTypes, type],
    }));
  }

  function togglePlatform(platform: Platform) {
    setFilters((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  async function saveProfile() {
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          preferredCities: citiesInput
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json();

      setProfileMessage(
        res.ok
          ? "Your profile has been updated."
          : typeof data.error === "string"
            ? data.error
            : "We couldn't save your profile. Please try again.",
      );
    } catch {
      setProfileMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveFilters() {
    setFiltersSaving(true);
    setFiltersMessage(null);

    try {
      const res = await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: keywordsInput,
          excludeKeywords: excludeInput,
          platforms: filters.platforms,
          minTrustScore: filters.minTrustScore,
          minMatchScore: filters.minMatchScore,
          pollIntervalMins: filters.pollIntervalMins,
        }),
      });
      const data = await res.json();

      setFiltersMessage(
        res.ok
          ? "Your job search filters have been updated."
          : typeof data.error === "string"
            ? data.error
            : "We couldn't save your filters. Please try again.",
      );
    } catch {
      setFiltersMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setFiltersSaving(false);
    }
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Signed in as {session?.user?.email}
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-400">
          {loadError}
        </div>
      )}

      <Card title="Profile" description="Tell ProAlly who to search jobs for">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              value={profile.fullName}
              onChange={(e) => setProfile((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <Label htmlFor="country">Preferred country (2-letter code)</Label>
            <Input
              id="country"
              value={profile.preferredCountry}
              onChange={(e) =>
                setProfile((p) => ({ ...p, preferredCountry: e.target.value.toUpperCase() }))
              }
              maxLength={2}
              placeholder="US"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cities">Preferred cities (comma-separated)</Label>
            <Input
              id="cities"
              value={citiesInput}
              onChange={(e) => setCitiesInput(e.target.value)}
              placeholder="Karachi, Dubai, Remote"
            />
          </div>
          <div>
            <Label htmlFor="minSalary">Minimum salary (optional)</Label>
            <Input
              id="minSalary"
              type="number"
              min={0}
              value={profile.minSalary ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  minSalary: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
              placeholder="50000"
            />
          </div>
          <div>
            <Label htmlFor="experienceLevel">Experience level</Label>
            <Select
              id="experienceLevel"
              value={profile.experienceLevel ?? ""}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  experienceLevel: (e.target.value || undefined) as
                    | ExperienceLevel
                    | undefined,
                }))
              }
            >
              <option value="">Not specified</option>
              {EXPERIENCE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level[0].toUpperCase() + level.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-4">
          <Label>Job types</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map((type) => (
              <Pill
                key={type}
                label={type}
                active={profile.jobTypes.includes(type)}
                onClick={() => toggleJobType(type)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Toggle
            label="Remote only"
            description="Only surface fully remote roles"
            checked={profile.remoteOnly}
            onChange={(checked) => setProfile((p) => ({ ...p, remoteOnly: checked }))}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={saveProfile} disabled={profileSaving}>
            {profileSaving ? "Saving…" : "Save profile"}
          </Button>
          {profileMessage ? (
            <span className="text-sm text-[var(--text-muted)]">{profileMessage}</span>
          ) : null}
        </div>
      </Card>

      <Card title="Job filters" description="Control what ProAlly scans for and alerts you on">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              value={keywordsInput}
              onChange={(e) => setKeywordsInput(e.target.value)}
              placeholder="react, typescript, frontend"
            />
          </div>
          <div>
            <Label htmlFor="excludeKeywords">Exclude keywords</Label>
            <Input
              id="excludeKeywords"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              placeholder="unpaid, internship"
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Platforms</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Pill
                key={p.value}
                label={p.label}
                active={filters.platforms.includes(p.value)}
                onClick={() => togglePlatform(p.value)}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="minTrustScore">
              Min trust score ({filters.minTrustScore})
            </Label>
            <input
              id="minTrustScore"
              type="range"
              min={0}
              max={100}
              value={filters.minTrustScore}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minTrustScore: Number(e.target.value) }))
              }
              className="w-full accent-violet-500"
            />
          </div>
          <div>
            <Label htmlFor="minMatchScore">
              Min match score ({filters.minMatchScore})
            </Label>
            <input
              id="minMatchScore"
              type="range"
              min={0}
              max={100}
              value={filters.minMatchScore}
              onChange={(e) =>
                setFilters((f) => ({ ...f, minMatchScore: Number(e.target.value) }))
              }
              className="w-full accent-violet-500"
            />
          </div>
          <div>
            <Label htmlFor="pollIntervalMins">Poll interval (minutes, min 15)</Label>
            <Input
              id="pollIntervalMins"
              type="number"
              min={15}
              value={filters.pollIntervalMins}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  pollIntervalMins: Math.max(15, Number(e.target.value) || 15),
                }))
              }
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={saveFilters} disabled={filtersSaving}>
            {filtersSaving ? "Saving…" : "Save filters"}
          </Button>
          {filtersMessage ? (
            <span className="text-sm text-[var(--text-muted)]">{filtersMessage}</span>
          ) : null}
        </div>
      </Card>

      <Card title="CV & resume" description="ProAlly matches jobs against your most recent CV">
        {cv ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
              <div>
                <p className="text-sm font-medium text-white">{cv.fileName}</p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Uploaded {new Date(cv.uploadedAt).toLocaleDateString()}
                  {!cv.parsingIncomplete && ` · ${cv.parsed.experienceYears} yrs experience`}
                </p>
              </div>
              <Button variant="secondary" onClick={() => setShowCvModal(true)}>
                Replace
              </Button>
            </div>
            {cv.parsingIncomplete ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-300">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                We&apos;re still reviewing this CV — your skill matches will appear here shortly.
              </div>
            ) : cv.parsed.skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set(cv.parsed.skills))
                  .slice(0, 20)
                  .map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[var(--border-default)] bg-[var(--bg-elevated)] px-2.5 py-1 text-xs text-[var(--text-secondary)]"
                    >
                      {skill}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              No CV on file yet — upload one so ProAlly can start matching jobs.
            </p>
            <CvUploader onUploaded={loadMe} />
          </div>
        )}
      </Card>

      {isAdmin && (
        <Card
          title="Job search integration"
          description="Admin only — powers LinkedIn and Indeed matching for every user via RapidAPI's JSearch"
        >
          {jsearchKeys.length === 0 && (
            <div
              className={`mb-4 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                jsearchUsingEnvFallback
                  ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                  : "border-rose-500/20 bg-rose-500/5 text-rose-300"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${jsearchUsingEnvFallback ? "bg-amber-500" : "bg-rose-500"}`}
              />
              {jsearchUsingEnvFallback
                ? "No keys saved here yet — currently falling back to the key in your environment configuration."
                : "No key configured — LinkedIn/Indeed matching is paused until a key is added."}
            </div>
          )}

          {jsearchKeys.length > 0 && (
            <div className="mb-4 space-y-2">
              {jsearchKeys.map((key) => {
                const busy = jsearchBusyId === key.id;
                const testing = jsearchTestingId === key.id;
                const anyBusy = busy || testing;
                return (
                  <div
                    key={key.id}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-white">{key.label}</p>
                          {key.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                          <JsearchStatusBadge status={key.status} />
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">{key.keyPreview}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => testJsearchKey(key.id)}
                          disabled={anyBusy}
                        >
                          {testing ? "Testing…" : "Test"}
                        </Button>
                        {key.isActive ? (
                          <Button
                            variant="secondary"
                            onClick={() => setJsearchKeyActive(key.id, false)}
                            disabled={anyBusy}
                          >
                            {busy ? "Working…" : "Deactivate"}
                          </Button>
                        ) : (
                          <Button onClick={() => setJsearchKeyActive(key.id, true)} disabled={anyBusy}>
                            {busy ? "Working…" : "Activate"}
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteJsearchKey(key.id, key.label)}
                          disabled={anyBusy}
                          title="Delete key"
                          className="rounded-lg p-2.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-rose-400 disabled:opacity-50"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {key.statusMessage && (
                      <p
                        className={`mt-2 text-xs ${
                          key.status === "ok"
                            ? "text-emerald-400"
                            : key.status === "quota_exceeded"
                              ? "text-amber-300"
                              : "text-rose-400"
                        }`}
                      >
                        {key.statusMessage}
                        {key.lastCheckedAt && (
                          <span className="text-[var(--text-dim)]">
                            {" "}
                            · Last checked {new Date(key.lastCheckedAt).toLocaleString()}
                          </span>
                        )}
                      </p>
                    )}
                    {key.isActive && (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {jsearchCadenceLabel(key)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Label htmlFor="jsearchKey">Add a key</Label>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              id="jsearchKeyLabel"
              value={jsearchLabelInput}
              onChange={(e) => setJsearchLabelInput(e.target.value)}
              placeholder="Label (optional)"
            />
            <Input
              id="jsearchKey"
              type="password"
              value={jsearchKeyInput}
              onChange={(e) => setJsearchKeyInput(e.target.value)}
              placeholder="Paste your RapidAPI JSearch key"
              autoComplete="off"
            />
            <Button
              onClick={addJsearchKey}
              disabled={jsearchAdding || !jsearchKeyInput.trim()}
              className="shrink-0"
            >
              {jsearchAdding ? "Adding…" : "Add key"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-dim)]">
            From RapidAPI Marketplace → JSearch. Only one key is ever active at a time — activating a key
            automatically deactivates any other. Changes take effect on the next job-matching run, no
            restart needed.
          </p>

          {jsearchMessage && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">{jsearchMessage}</p>
          )}
        </Card>
      )}

      {showCvModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowCvModal(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md animate-fade-in rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Replace CV</h2>
              <button
                onClick={() => setShowCvModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-white"
              >
                ✕
              </button>
            </div>
            <CvUploader
              onUploaded={() => {
                setShowCvModal(false);
                loadMe();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * How the active key's fetch cadence is communicated to the admin — derived
 * entirely from what the key itself has told us (its own quota headers), not
 * a fixed guess. See src/lib/jobs/fetchCadence.ts for the actual math.
 */
function jsearchCadenceLabel(key: JsearchKey): string {
  if (!key.fetchIntervalMinutes) {
    return "Frequency will be set automatically after the first scan or a manual Test.";
  }

  const hrs = key.fetchIntervalMinutes / 60;
  const cadence = hrs >= 1 ? `~${Math.round(hrs * 10) / 10}h` : `~${key.fetchIntervalMinutes}m`;
  const perDay = Math.max(1, Math.round(1440 / key.fetchIntervalMinutes));

  const quotaPart =
    key.requestsRemainingKnown !== null && key.monthlyLimit !== null
      ? ` · ${key.requestsRemainingKnown} of ${key.monthlyLimit} requests remaining this cycle`
      : "";

  const nextFetchPart =
    key.lastFetchedAt && key.fetchIntervalMinutes
      ? ` · next fetch ~${new Date(
          new Date(key.lastFetchedAt).getTime() + key.fetchIntervalMinutes * 60_000,
        ).toLocaleString()}`
      : "";

  return `We'll hit JSearch every ${cadence} (~${perDay}×/day)${quotaPart}${nextFetchPart}.`;
}

function JsearchStatusBadge({ status }: { status: JsearchKeyStatus }) {
  switch (status) {
    case "ok":
      return <Badge tone="success">Verified working</Badge>;
    case "quota_exceeded":
      return <Badge tone="warning">Monthly limit reached</Badge>;
    case "invalid":
      return <Badge tone="danger">Rejected by RapidAPI</Badge>;
    case "error":
      return <Badge tone="danger">Last check failed</Badge>;
    default:
      return <Badge>Not tested yet</Badge>;
  }
}

function SettingsCardSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-2 h-3.5 w-56" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="mt-5 h-10 w-24" />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <SettingsCardSkeleton fields={4} />
      <SettingsCardSkeleton fields={2} />
      <SettingsCardSkeleton fields={1} />
    </div>
  );
}
