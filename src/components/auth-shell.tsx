import { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-4 py-12">
      {/* Glow backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-violet-600/8 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-cyan-600/6 blur-[100px]" />
        <div className="absolute bottom-0 left-0 h-[350px] w-[350px] rounded-full bg-emerald-600/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 shadow-lg shadow-violet-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            ProAlly
          </span>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-2xl shadow-black/40">
          <div className="mb-6 text-center">
            <h1 className="text-xl font-semibold text-white">{title}</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p>
          </div>

          {children}
        </div>

        {footer ? (
          <p className="mt-6 text-center text-xs text-[var(--text-dim)]">
            {footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
