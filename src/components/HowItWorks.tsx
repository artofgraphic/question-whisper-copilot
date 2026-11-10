import { ListChecks, Mic, PictureInPicture2, Radio, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: Mic,
    title: "Pick what to listen to",
    body: "Settings → Source → “Interviewer tab + my mic (recommended)”. It hears the meeting tab and your own voice.",
  },
  {
    icon: Radio,
    title: "Start listening",
    body: "Session → Start listening, then choose the meeting tab in the popup and turn on “Also share tab audio”.",
  },
  {
    icon: ListChecks,
    title: "Questions become numbered sections",
    body: "Each detected question gets its own section with an answer you can say out loud. New questions appear below the old ones.",
  },
  {
    icon: PictureInPicture2,
    title: "Keep answers beside the call",
    body: "Floating overlay opens a small window that stays on top of Zoom, Meet or Teams.",
  },
  {
    icon: ShieldCheck,
    title: "Answers get fact-checked",
    body: "A separate check searches live web sources and labels each claim Supported, Potentially stale, Contradicted, Unverified or Needs personal confirmation.",
  },
];

export function HowItWorks({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-card" aria-labelledby="how-it-works-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">First time here</p>
          <h2 id="how-it-works-title" className="mt-2 text-xl font-semibold">
            How it works
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Five steps, about a minute. You can close this any time.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onDismiss}>
          Got it — don't show again
        </Button>
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
              <s.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span> {s.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Built for practice and prep. Use it only where AI assistance is permitted, and treat every answer as a
        suggestion to check, not a fact.
      </p>
    </section>
  );
}
