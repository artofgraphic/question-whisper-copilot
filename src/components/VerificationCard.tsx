import { useState } from "react";
import { CheckCircle2, Clock, XCircle, HelpCircle, User, ChevronDown, ExternalLink, Loader2, ShieldCheck, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_LABEL, type ClaimStatus, type VerificationReport } from "@/lib/verify/types";

const ICON: Record<ClaimStatus, typeof CheckCircle2> = { supported: CheckCircle2, stale: Clock, contradicted: XCircle, unverified: HelpCircle, personal: User };
const TONE: Record<ClaimStatus, string> = {
  supported: "border-primary/40 text-primary",
  stale: "border-chart-4/50 text-chart-4",
  contradicted: "border-destructive/50 text-destructive",
  unverified: "border-border text-muted-foreground",
  personal: "border-accent text-accent-foreground",
};

export function StatusBadge({ status }: { status: ClaimStatus }) {
  const I = ICON[status];
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${TONE[status]}`}><I className="h-3 w-3" />{STATUS_LABEL[status]}</span>;
}

export function VerificationCard({ report, loading, onRecheck, compact, defaultOpen = false }: {
  report?: VerificationReport | undefined; loading?: boolean; onRecheck?: () => void; compact?: boolean; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!report && !loading) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-background/40 text-sm" id="verification">
      <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold">Answer verification</span>
        {loading ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />checking live sources…</span>
          : report?.error ? <span className="text-xs text-destructive">{report.error}</span>
          : report && <><StatusBadge status={report.overall} />{!compact && <span className="text-xs text-muted-foreground">{report.claims.length} claim{report.claims.length === 1 ? "" : "s"}</span>}</>}
        <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && report && !report.error && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(report.counts) as ClaimStatus[]).filter((s) => report.counts[s]).map((s) => (
              <span key={s} className="text-[11px] text-muted-foreground">{STATUS_LABEL[s]}: <b className="text-foreground">{report.counts[s]}</b></span>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">Checked {new Date(report.checkedAt).toLocaleString()}</span>
          </div>
          {report.claims.length === 0 && <p className="text-xs text-muted-foreground">No checkable factual claims in this answer.</p>}
          {report.claims.map((c, i) => (
            <div key={i} className="rounded-md border border-border p-2.5">
              <div className="flex flex-wrap items-start gap-2"><StatusBadge status={c.status} /><p className="flex-1 text-xs font-medium">{c.claim}</p></div>
              <p className="mt-1 text-xs text-muted-foreground">{c.reasoning}</p>
              {c.evidence.map((e, j) => (
                <div key={j} className="mt-2 border-l-2 border-border pl-2">
                  <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />{e.title}</a>
                  <p className="text-[10px] text-muted-foreground">{e.publishedDate ? `Published ${e.publishedDate.slice(0, 16)}` : "Publication date unknown"} · {new URL(e.url).hostname}</p>
                  {!compact && <p className="mt-0.5 text-[11px] italic text-muted-foreground">“{e.snippet.slice(0, 240)}…”</p>}
                </div>
              ))}
            </div>
          ))}
          {report.correctedAnswer && (
            <div className="rounded-md border border-chart-4/50 p-2.5">
              <p className="text-[11px] font-semibold">Suggested corrected answer</p>
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">{report.correctedAnswer}</p>
            </div>
          )}
        </div>
      )}
      {onRecheck && !loading && report && open && (
        <div className="border-t border-border px-3 py-2"><Button size="sm" variant="ghost" onClick={onRecheck}><RotateCw className="mr-1 h-3.5 w-3.5" />Recheck</Button></div>
      )}
    </div>
  );
}
