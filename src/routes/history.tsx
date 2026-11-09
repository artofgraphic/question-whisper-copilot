import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSession, loadSessions, type Session } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Session History — A'wn Khafi" },
      { name: "description", content: "Review transcripts, detected questions and answers from past sessions." },
      { property: "og:title", content: "Session History — A'wn Khafi" },
      { property: "og:description", content: "Review transcripts, detected questions and answers from past sessions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const child = useMatch({ from: "/history/$id", shouldThrow: false });
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => setSessions(loadSessions()), [child]);
  if (child) return <Outlet />;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Session history</h1>
      <p className="mt-1 text-sm text-muted-foreground">Saved in this browser only: date, transcript, detected questions and answers. Audio is never saved.</p>
      {sessions.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">No saved sessions yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
              <Link to="/history/$id" params={{ id: s.id }} className="min-w-0 flex-1 hover:text-primary">
                <p className="truncate text-sm font-medium">{s.qas[0]?.question || "No questions detected"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(s.startedAt).toLocaleString()} · {s.qas.length} answer{s.qas.length === 1 ? "" : "s"} · {s.transcript.length} transcript lines
                </p>
              </Link>
              <Button size="icon" variant="ghost" aria-label="Delete session" onClick={() => { deleteSession(s.id); setSessions(loadSessions()); }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
