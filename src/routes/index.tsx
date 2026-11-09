import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Mic, MicOff, Radio, Settings, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSessions, type Session } from "@/lib/store";
import { useAudioStatus } from "@/hooks/use-audio-status";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "A'wn Khafi — Real-time AI interview copilot" },
      { name: "description", content: "Start a live session: A'wn Khafi listens, detects questions and suggests spoken answers." },
      { property: "og:title", content: "A'wn Khafi — Real-time AI interview copilot" },
      { property: "og:description", content: "Start a live session: A'wn Khafi listens, detects questions and suggests spoken answers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const { permission, devices, request } = useAudioStatus();
  useEffect(() => setSessions(loadSessions()), []);

  const micOk = permission === "granted";
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <section className="rounded-2xl border border-border bg-card p-8 shadow-card">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Interview copilot</p>
        <h1 className="mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
          The interviewer speaks. You get the answer.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          A'wn Khafi listens to the conversation, picks out each question and writes an answer you can say
          naturally — in a floating window next to Zoom, Meet or Teams.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild size="lg" className="shadow-glow">
            <Link to="/session">
              <Radio className="mr-1 h-4 w-4" /> Start Live Session
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link to="/settings">
              <Settings className="mr-1 h-4 w-4" /> Settings
            </Link>
          </Button>
        </div>
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="text-sm font-semibold">Audio status</h2>
          <div className="mt-4 flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-full ${micOk ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {micOk ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </div>
            <div className="text-sm">
              <p className="font-medium">
                {micOk ? "Microphone allowed" : permission === "denied" ? "Microphone blocked" : "Permission not granted yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                Not listening · {devices.length || "—"} input{devices.length === 1 ? "" : "s"} found
              </p>
            </div>
          </div>
          {!micOk && permission !== "denied" && (
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => request().catch(() => {})}>
              Allow microphone
            </Button>
          )}
          {permission === "denied" && (
            <p className="mt-3 text-xs text-muted-foreground">Allow microphone access in your browser's site settings.</p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-card md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent sessions</h2>
            <Link to="/history" className="text-xs text-muted-foreground hover:text-primary">View all</Link>
          </div>
          {sessions.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No sessions yet. Your first live session will appear here.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {sessions.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <Link to="/history/$id" params={{ id: s.id }} className="flex items-center gap-3 py-3 text-sm hover:text-primary">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{s.qas[0]?.question || "Session with no detected questions"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(s.startedAt).toLocaleString()}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
