"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function ChatIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function goToASession() {
      try {
        const res = await fetch("/api/chat/sessions");
        const data = await res.json();

        if (!res.ok) {
          if (!cancelled) {
            setError(
              typeof data.error === "string"
                ? data.error
                : "We couldn't load your chats right now.",
            );
          }
          return;
        }
        if (cancelled) return;

        if (data.sessions.length > 0) {
          router.replace(`/chat/${data.sessions[0].id}`);
          return;
        }

        const createRes = await fetch("/api/chat/sessions", { method: "POST" });
        const createData = await createRes.json();
        if (cancelled) return;

        if (!createRes.ok) {
          setError(
            typeof createData.error === "string"
              ? createData.error
              : "We couldn't start a new chat right now.",
          );
          return;
        }

        router.replace(`/chat/${createData.id}`);
      } catch {
        if (!cancelled) {
          setError("We couldn't reach the server. Please check your connection and try again.");
        }
      }
    }

    goToASession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-32 text-[var(--text-muted)]">
      <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      <p>Loading ProAlly AI…</p>
    </div>
  );
}
