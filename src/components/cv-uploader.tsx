"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui";

const TIPS = [
  "ProAlly rescans LinkedIn and Indeed for new roles every few minutes once your CV is on file.",
  "Ask ProAlly AI to tailor a cover letter for any job in your pipeline — just open a chat and paste the listing in.",
  "Fine-tune your Min Match Score in Settings to control how selective your job alerts are.",
  "Save a role with one click from the Dashboard, then track it through to an offer on the Job Pipeline board.",
  "Every match comes with an AI-generated score — open a job card to see exactly why it was recommended.",
  "Add your preferred cities in Settings so ProAlly can prioritize opportunities near you.",
  "You can keep multiple conversations going with ProAlly AI — each one remembers its own history.",
];

export function CvUploader({ onUploaded }: { onUploaded?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [loading]);

  function pickFile(next: File | null) {
    setFile(next);
    setError(null);
    setSuccess(null);
  }

  async function handleUpload() {
    if (!file) {
      setError("Please choose a CV file first.");
      return;
    }

    setLoading(true);
    setTipIndex(0);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/cv/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "We couldn't upload your CV right now. Please try again in a moment.",
        );
        return;
      }

      setSuccess(
        typeof data.message === "string"
          ? data.message
          : "Your CV has been uploaded successfully.",
      );
      setFile(null);
      onUploaded?.();
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-6 py-8 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-sm font-semibold text-white">Analyzing your CV…</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          This usually takes a few seconds. Feel free to keep this open.
        </p>
        <div className="mt-5 min-h-[36px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5">
          <p key={tipIndex} className="animate-fade-in text-xs leading-relaxed text-[var(--text-secondary)]">
            <span className="font-semibold text-violet-400">Tip · </span>
            {TIPS[tipIndex]}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-8 text-center transition ${
          dragActive
            ? "border-violet-500 bg-violet-500/5"
            : "border-[var(--border-default)] bg-[var(--bg-primary)] hover:border-[var(--border-accent)]"
        }`}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="text-[var(--text-muted)]"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        {file ? (
          <p className="text-sm font-medium text-white">{file.name}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Drop your CV here, or click to browse
            </p>
            <p className="text-xs text-[var(--text-dim)]">PDF or TXT, up to 5MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,application/pdf,text/plain"
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>

      <Button onClick={handleUpload} disabled={loading || !file} className="w-full">
        Upload CV
      </Button>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}
    </div>
  );
}
