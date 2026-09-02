import { ReactNode } from "react";

import { parseDescriptionBlocks } from "@/lib/jobs/descriptionFormat";

export function Card({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] ${className}`}
    >
      {title ? (
        <div className="mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    default:
      "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]",
    success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
    info: "bg-violet-500/10 text-violet-300 border border-violet-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const variants = {
    primary:
      "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100",
    secondary:
      "border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-white disabled:opacity-50",
    ghost:
      "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white disabled:opacity-50",
    danger:
      "border border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 disabled:opacity-50",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]"
    >
      {children}
    </label>
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-28 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full appearance-none rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-white outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-4 py-3 text-left transition hover:border-[var(--border-accent)]"
    >
      <span>
        <span className="block text-sm font-medium text-white">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-gradient-to-r from-violet-600 to-cyan-600" : "bg-[var(--bg-elevated)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

export function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        active
          ? "border-violet-500/30 bg-violet-500/15 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.06)]"
          : "border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--border-accent)] hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

/** Shimmering placeholder for content that's still loading — use instead of a raw 0/blank default so nothing false ever flashes on screen. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1.5 text-xs text-rose-400">{children}</p>;
}

/** Brand-ish accent colors for the platforms JSearch actually aggregates from — falls back to a neutral chip for anything unrecognized. */
const PLATFORM_ACCENTS: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  linkedin: { dot: "bg-[#0A66C2]", text: "text-[#4B9FE1]", bg: "bg-[#0A66C2]/10", border: "border-[#0A66C2]/25" },
  indeed: { dot: "bg-[#4285F4]", text: "text-[#6FA0F5]", bg: "bg-[#4285F4]/10", border: "border-[#4285F4]/25" },
  upwork: { dot: "bg-[#14A800]", text: "text-[#3ECF3E]", bg: "bg-[#14A800]/10", border: "border-[#14A800]/25" },
};

const NEUTRAL_ACCENT = {
  dot: "bg-[var(--text-dim)]",
  text: "text-[var(--text-secondary)]",
  bg: "bg-[var(--bg-elevated)]",
  border: "border-[var(--border-default)]",
};

/** The board actually shown to the user — `source` ("jsearch") is a fetch mechanism, not a board name. */
export function platformLabel(source: string, publisher?: string | null): string {
  if (publisher) return publisher;
  if (source === "jsearch") return "Job board";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export function PlatformChip({
  source,
  publisher,
  className = "",
}: {
  source: string;
  publisher?: string | null;
  className?: string;
}) {
  const label = platformLabel(source, publisher);
  const accent = PLATFORM_ACCENTS[(publisher || source || "").toLowerCase()] ?? NEUTRAL_ACCENT;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accent.bg} ${accent.text} ${accent.border} ${className}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot}`} />
      {label}
    </span>
  );
}

/** Renders a job description the way real job boards do — section headings and bullet lists, not one dense wall of text. */
export function JobDescription({ text, className = "" }: { text: string; className?: string }) {
  if (!text || !text.trim()) {
    return <p className={`text-sm text-[var(--text-muted)] ${className}`}>No description available.</p>;
  }

  const blocks = parseDescriptionBlocks(text);

  return (
    <div className={`space-y-3 text-sm leading-relaxed text-[var(--text-secondary)] ${className}`}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          return (
            <h4
              key={i}
              className="pt-1 text-[13px] font-semibold uppercase tracking-wide text-white/90 first:pt-0"
            >
              {block.text}
            </h4>
          );
        }
        if (block.type === "bullets") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-violet-400">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
