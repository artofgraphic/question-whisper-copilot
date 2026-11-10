import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { loadSessions, type Session } from "@/lib/store";
import { ExportButtons } from "@/components/ExportButtons";
import { VerificationCard } from "@/components/VerificationCard";
import { requestVerification } from "@/lib/verify/client";
import { saveSession } from "@/lib/store";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Session Details — A'wn Khafi" },
      { name: "description", content: "Transcript, questions and suggested answers from a past session." },
      { property: "og:title", content: "Session Details — A'wn Khafi" },
      { property: "og:description", content: "Transcript, questions and suggested answers from a past session." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SessionDetail,
});

function SessionDetail() {
  const { id } = Route.useParams();
  const [s, setS] = useState<Session | null | undefined>(undefined);
  useEffect(() => setS(loadSessions().find((x) => x.id === id) ?? null), [id]);
  if (s === undefined) return null;
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/history" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />All sessions</Link>
      {!s ? (
        <p className="mt-6 text-sm text-muted-foreground">This session isn't saved in this browser.</p>
      ) : (
        <>
          <h1 className="mt-4 text-2xl font-semibold">{new Date(s.startedAt).toLocaleString()}</h1>
          <div className="mt-4"><ExportButtons session={s} /></div>
          <h2 className="mt-8 text-sm font-semibold">Questions & answers</h2>
          <div className="mt-3 space-y-3">
            {s.qas.length === 0 && <p className="text-sm text-muted-foreground">No questions were detected.</p>}
            {s.qas.map((q, i) => (
              <article key={q.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Question {i + 1}{q.stage ? ` · Stage ${q.stage}` : ""}</p>
                <p className="mt-1 text-sm font-medium text-primary">{q.question}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{q.answer}</p>
                {q.points.length > 0 && <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{q.points.map((p, i) => <li key={i}>• {p}</li>)}</ul>}
                <HistoryVerify session={s} qa={q} onChange={setS} />
              </article>
            ))}
          </div>
          <h2 className="mt-8 text-sm font-semibold">Transcript</h2>
          <div className="mt-3 space-y-1 rounded-xl border border-border bg-card p-5 text-sm">
            {s.transcript.length === 0 && <p className="text-muted-foreground">Empty.</p>}
            {s.transcript.map((l) => (
              <p key={l.id}><span className="mr-2 font-mono text-[10px] text-muted-foreground">{new Date(l.at).toLocaleTimeString()}</span>{l.text}</p>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function HistoryVerify({ session, qa, onChange }: { session: Session; qa: Session["qas"][number]; onChange: (s: Session) => void }) {
  const [loading, setLoading] = useState(false);
  const recheck = async () => {
    setLoading(true);
    let v;
    try { v = await requestVerification({ question: qa.question, answer: qa.answer }); }
    catch (e) { v = { checkedAt: Date.now(), overall: "unverified" as const, counts: { supported: 0, stale: 0, contradicted: 0, unverified: 0, personal: 0 }, claims: [], error: (e as Error).message }; }
    const next = { ...session, qas: session.qas.map((x) => (x.id === qa.id ? { ...x, verification: v } : x)) };
    saveSession(next); onChange(next); setLoading(false);
  };
  if (!qa.verification && !loading) return <button onClick={recheck} className="mt-3 text-xs text-primary hover:underline">Verify this answer against live sources</button>;
  return <VerificationCard report={qa.verification} loading={loading} onRecheck={recheck} />;
}
