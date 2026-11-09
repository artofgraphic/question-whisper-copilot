import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy, RefreshCw, Minimize2, Maximize2, Pencil, Check, Mic, Pause, Play, Square,
  PictureInPicture2, Sparkles, Loader2, Monitor, AlertTriangle, X, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LiveListener, transcribeSegment, type ListenerState } from "@/lib/audio";
import { looksLikeQuestion, parseAnswer, streamAnswer, type ParsedAnswer } from "@/lib/answer";
import { lengthLabel, loadSettings, saveSession, saveSettings, uid, type QA, type Session, type Settings, type TranscriptLine } from "@/lib/store";
import { useAudioStatus } from "@/hooks/use-audio-status";
import { FloatingOverlay, pipSupported } from "@/components/FloatingOverlay";
import { ExportButtons } from "@/components/ExportButtons";

export const Route = createFileRoute("/session")({
  head: () => ({
    meta: [
      { title: "Live Session — A'wn Khafi" },
      { name: "description", content: "Live transcript, detected questions and AI-suggested answers in real time." },
      { property: "og:title", content: "Live Session — A'wn Khafi" },
      { property: "og:description", content: "Live transcript, detected questions and AI-suggested answers in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveSession,
});

type Mode = "auto" | "manual" | "regenerate" | "shorter" | "expand";
const empty: ParsedAnswer = { noQuestion: false, question: "", subject: "", answer: "", points: [] };

function LiveSession() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const { devices, permission, refresh } = useAudioStatus();
  const [state, setState] = useState<ListenerState>("idle");
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [pendingFrom, setPendingFrom] = useState(0);
  const [transcribing, setTranscribing] = useState(0);
  const [answer, setAnswer] = useState<ParsedAnswer>(empty);
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [qas, setQas] = useState<QA[]>([]);
  const [overlay, setOverlay] = useState(false);
  const [compact, setCompact] = useState(true);
  const [editLine, setEditLine] = useState<string | null>(null);
  const [stage, setStage] = useState(1);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const [pendingNew, setPendingNew] = useState(false);
  const overlayEnd = useRef<HTMLDivElement>(null);

  const listener = useRef<LiveListener | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const sessionRef = useRef<Session | null>(null);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const pendingRef = useRef(pendingFrom);
  pendingRef.current = pendingFrom;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const answerAbort = useRef<AbortController | null>(null);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const lastQaId = useRef<string | null>(null);

  useEffect(() => {
    transcriptEnd.current?.scrollIntoView({ block: "end" });
  }, [lines.length]);

  // Persist session as it evolves
  useEffect(() => {
    const s = sessionRef.current;
    if (!s || !settings.saveHistory) return;
    s.transcript = lines;
    s.qas = qas;
    if (lines.length || qas.length) saveSession(s);
  }, [lines, qas, settings.saveHistory]);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  const runAnswer = useCallback(async (mode: Mode, overrideText?: string) => {
    const all = linesRef.current;
    const pending = all.slice(pendingRef.current).map((l) => l.text).join(" ").trim();
    let text = overrideText ?? pending;
    if (mode === "regenerate" || mode === "shorter" || mode === "expand") text = overrideText ?? "";
    if (!text) {
      if (mode === "manual") text = all.slice(-3).map((l) => l.text).join(" ");
      if (!text) {
        toast.message("Nothing to answer yet — wait for the interviewer to speak.");
        return;
      }
    }
    if (mode === "auto" || mode === "manual") setPendingFrom(all.length);
    answerAbort.current?.abort();
    const ac = new AbortController();
    answerAbort.current = ac;
    setGenerating(true);
    setPendingNew(mode === "auto" || mode === "manual");
    setEditing(false);
    const s = settingsRef.current;
    const prevAnswer = answerRefCur.current;
    const ctx = all.slice(Math.max(0, pendingRef.current - 8), pendingRef.current).map((l) => l.text).join(" ");
    try {
      const raw = await streamAnswer(
        {
          text,
          context: ctx,
          mode,
          previous: mode === "auto" || mode === "manual" ? undefined : prevAnswer.answer,
          prefs: { length: lengthLabel[s.length], tone: s.tone, profile: s.profile },
        },
        (r) => {
          const p = parseAnswer(r);
          if (!p.noQuestion && (p.answer || p.question)) setAnswer(p);
        },
        ac.signal,
      );
      const p = parseAnswer(raw);
      if (p.error) toast.error(p.error);
      if (p.noQuestion) {
        if (mode === "manual") toast.message("No question detected in the recent speech.");
        return;
      }
      setAnswer(p);
      const isRevision = mode === "regenerate" || mode === "shorter" || mode === "expand";
      if (isRevision && lastQaId.current) {
        setQas((q) => q.map((x) => (x.id === lastQaId.current ? { ...x, answer: p.answer, points: p.points } : x)));
      } else if (p.answer) {
        const qa: QA = { id: uid(), at: Date.now(), question: p.question || text, subject: p.subject, answer: p.answer, points: p.points, stage: stageRef.current };
        lastQaId.current = qa.id;
        setQas((q) => [...q, qa]);
      }
    } catch (e) {
      if (!ac.signal.aborted) toast.error((e as Error).message);
    } finally {
      if (answerAbort.current === ac) { setGenerating(false); setPendingNew(false); }
    }
  }, []);

  const answerRefCur = useRef(answer);
  answerRefCur.current = answer;

  const onTranscript = useCallback(
    (text: string) => {
      if (!text) return;
      setLines((prev) => {
        // avoid duplicate transcription of identical consecutive segments
        if (prev.at(-1)?.text.trim().toLowerCase() === text.trim().toLowerCase()) return prev;
        return [...prev, { id: uid(), at: Date.now(), text }];
      });
      if (!settingsRef.current.autoDetect) return;
      if (detectTimer.current) clearTimeout(detectTimer.current);
      detectTimer.current = setTimeout(() => {
        const pending = linesRef.current.slice(pendingRef.current).map((l) => l.text).join(" ");
        if (looksLikeQuestion(pending)) runAnswer("auto");
      }, 1100);
    },
    [runAnswer],
  );

  const start = async () => {
    try {
      const l = new LiveListener({
        source: settings.source,
        deviceId: settings.deviceId || undefined,
        silenceMs: settings.silenceMs,
        onLevel: (r, sp) => {
          setLevel(r);
          setSpeaking(sp);
        },
        onEnded: () => stop(),
        onSegment: (file) => {
          setTranscribing((n) => n + 1);
          queue.current = queue.current.then(async () => {
            try {
              const t = await transcribeSegment(file, settingsRef.current.language);
              onTranscript(t);
            } catch (e) {
              toast.error(`Couldn't transcribe a segment: ${(e as Error).message}`);
            } finally {
              setTranscribing((n) => n - 1);
            }
          });
        },
      });
      await l.start();
      listener.current = l;
      if (!sessionRef.current) {
        sessionRef.current = { id: uid(), startedAt: Date.now(), transcript: [], qas: [] };
      }
      setState("listening");
      refresh();
    } catch (e) {
      const err = e as DOMException;
      toast.error(
        err.name === "NotAllowedError"
          ? "Permission was denied. Allow audio access to start listening."
          : err.message || "Could not start audio capture",
      );
    }
  };

  const pause = () => {
    listener.current?.pause();
    setState("paused");
    setLevel(0);
    setSpeaking(false);
  };
  const resume = () => {
    listener.current?.resume();
    setState("listening");
  };
  const stop = useCallback(async () => {
    const l = listener.current;
    listener.current = null;
    await l?.stop();
    setState("idle");
    setLevel(0);
    setSpeaking(false);
    const s = sessionRef.current;
    if (s && settingsRef.current.saveHistory && (linesRef.current.length || s.qas.length)) {
      s.endedAt = Date.now();
      s.transcript = linesRef.current;
      saveSession(s);
    }
  }, []);

  useEffect(() => () => {
    listener.current?.stop();
    answerAbort.current?.abort();
  }, []);

  const changeInput = async (v: string) => {
    const [source, deviceId] = v.split("::") as [Settings["source"], string];
    updateSettings({ source, deviceId: deviceId ?? "" });
    if (state !== "idle") {
      await listener.current?.stop();
      listener.current = null;
      setState("idle");
      setTimeout(() => toast.message("Input changed — press Start to listen on the new source."), 0);
    }
  };

  const copy = async (txt = answer.answer) => {
    await navigator.clipboard.writeText(txt);
    toast.success("Answer copied");
  };

  useEffect(() => {
    overlayEnd.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [qas.length, pendingNew, answer.answer]);

  const newStage = () => {
    setStage((n) => n + 1);
    setPendingFrom(linesRef.current.length);
    setAnswer(empty);
    lastQaId.current = null;
    toast.success(`Stage ${stage + 1} started — overlay cleared. Earlier answers are kept in the summary.`);
  };

  const stageQas = qas.map((q, i) => ({ q, n: i + 1 })).filter((x) => (x.q.stage ?? 1) === stage);
  const liveSession: Session = { id: sessionRef.current?.id ?? "live", startedAt: sessionRef.current?.startedAt ?? Date.now(), transcript: lines, qas };

  const sourceValue = settings.source === "system" ? "system::" : `mic::${settings.deviceId}`;
  const lastQuestion = answer.question || qas.at(-1)?.question;
  const pendingText = lines.slice(pendingFrom).map((l) => l.text).join(" ");

  const statusDot = state === "listening" ? (speaking ? "bg-primary" : "bg-live") : state === "paused" ? "bg-chart-4" : "bg-muted-foreground";

  const overlayBody = (
    <div className="flex h-screen flex-col gap-2 p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${statusDot} ${state === "listening" ? "animate-pulse" : ""}`} />
        <span className="text-xs text-muted-foreground">
          {state === "listening" ? "Listening" : state === "paused" ? "Paused" : "Stopped"}
          {generating && " · writing answer…"}
        </span>
        <div className="ml-auto flex gap-1">
          {state === "listening" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={pause}><Pause className="h-3.5 w-3.5" /></Button>}
          {state === "paused" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resume}><Play className="h-3.5 w-3.5" /></Button>}
          {state !== "idle" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={stop}><Square className="h-3.5 w-3.5" /></Button>}
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCompact((c) => !c)}>
            {compact ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" title="New stage — clear the overlay" onClick={newStage}><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="flex-1 space-y-2 overflow-auto pr-1">
        {stage > 1 && <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Stage {stage}</p>}
        {stageQas.length === 0 && !pendingNew && <p className="text-muted-foreground">The next suggested answer will appear here.</p>}
        {stageQas.map(({ q, n }) => {
          const live = generating && !pendingNew && q.id === lastQaId.current;
          const text = live ? answer.answer : q.answer;
          const latest = q.id === lastQaId.current;
          return (
            <div key={q.id} className={`rounded-lg border p-2.5 ${latest ? "border-primary/40 bg-accent/30" : "border-border opacity-80"}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">Q{n}</span>
                <p className="flex-1 text-xs text-primary">{q.question}</p>
                <button onClick={() => copy(text)} aria-label="Copy this answer" className="text-muted-foreground hover:text-primary"><Copy className="h-3 w-3" /></button>
              </div>
              <p className={`${compact ? "text-[14px]" : "text-[15px]"} mt-1.5 whitespace-pre-wrap leading-relaxed`}>{text}</p>
              {!compact && q.points.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{q.points.map((p, i) => <li key={i}>• {p}</li>)}</ul>
              )}
            </div>
          );
        })}
        {pendingNew && (
          <div className="rounded-lg border border-primary/40 bg-accent/30 p-2.5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 rounded bg-primary px-1.5 font-mono text-[10px] text-primary-foreground">Q{qas.length + 1}</span>
              <p className="flex-1 text-xs text-primary">{answer.question || "Listening to the question…"}</p>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed">{answer.answer || <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}</p>
          </div>
        )}
        <div ref={overlayEnd} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:px-6">
      {/* Control bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
        <div className="flex items-center gap-2 pl-1">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDot} ${state === "listening" ? "animate-pulse" : ""}`} />
          <span className="text-sm font-medium">
            {state === "listening" ? (speaking ? "Hearing speech" : "Listening") : state === "paused" ? "Paused" : "Not listening"}
          </span>
          {transcribing > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />transcribing</span>}
        </div>
        <LevelMeter level={state === "listening" ? level : 0} />
        <Select value={sourceValue} onValueChange={changeInput}>
          <SelectTrigger className="h-9 w-64"><SelectValue placeholder="Audio input" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="mic::">Default microphone</SelectItem>
            {devices.filter((d) => d.deviceId && d.deviceId !== "default").map((d, i) => (
              <SelectItem key={d.deviceId} value={`mic::${d.deviceId}`}>{d.label || `Microphone ${i + 1}`}</SelectItem>
            ))}
            <SelectItem value="system::">Tab / system audio (share screen)</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          {state === "idle" && <Button onClick={start}><Mic className="mr-1 h-4 w-4" />Start listening</Button>}
          {state === "listening" && <Button variant="secondary" onClick={pause}><Pause className="mr-1 h-4 w-4" />Pause</Button>}
          {state === "paused" && <Button onClick={resume}><Play className="mr-1 h-4 w-4" />Resume</Button>}
          {state !== "idle" && <Button variant="destructive" onClick={stop}><Square className="mr-1 h-4 w-4" />Stop</Button>}
          <Button variant="outline" onClick={newStage} disabled={stageQas.length === 0} title="Clear the overlay and start the next stage">
            <Layers className="mr-1 h-4 w-4" />New stage{stage > 1 ? ` (now ${stage})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={() => (pipSupported() ? setOverlay((o) => !o) : toast.error("Floating overlay needs Chrome or Edge 116+ on desktop."))}
          >
            <PictureInPicture2 className="mr-1 h-4 w-4" />{overlay ? "Close overlay" : "Floating overlay"}
          </Button>
        </div>
      </div>

      {settings.source === "system" && state === "idle" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Monitor className="h-3.5 w-3.5" />
          You'll be asked to share a tab or screen — pick the meeting tab and turn on “Share audio”. Works best in Chrome/Edge.
        </p>
      )}
      {permission === "denied" && settings.source === "mic" && (
        <p className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Microphone access is blocked in your browser settings.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Answer column */}
        <div className="flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Detected question</h2>
              {answer.subject && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">{answer.subject}</span>}
            </div>
            <p className="mt-2 text-base font-medium">{lastQuestion || <span className="text-muted-foreground">Waiting for a question…</span>}</p>
          </section>

          <section className="rounded-2xl border border-primary/30 bg-card p-6 shadow-glow">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-primary">Suggested Answer</h2>
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            </div>
            {editing ? (
              <div className="mt-4 space-y-2">
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={8} className="text-base leading-relaxed" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => {
                    setAnswer((a) => ({ ...a, answer: draft }));
                    setQas((q) => q.map((x) => (x.id === lastQaId.current ? { ...x, answer: draft } : x)));
                    setEditing(false);
                  }}><Check className="mr-1 h-3.5 w-3.5" />Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="mt-4 min-h-28 whitespace-pre-wrap text-lg leading-relaxed md:text-xl">
                {answer.answer || <span className="text-base text-muted-foreground">When the interviewer asks a question, the answer will appear here.</span>}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button size="sm" variant="secondary" disabled={!answer.answer} onClick={() => copy()}><Copy className="mr-1 h-3.5 w-3.5" />Copy Answer</Button>
              <Button size="sm" variant="secondary" disabled={!answer.answer || generating} onClick={() => runAnswer("regenerate", lastQuestion)}><RefreshCw className="mr-1 h-3.5 w-3.5" />Regenerate</Button>
              <Button size="sm" variant="secondary" disabled={!answer.answer || generating} onClick={() => runAnswer("shorter", lastQuestion)}><Minimize2 className="mr-1 h-3.5 w-3.5" />Shorter</Button>
              <Button size="sm" variant="secondary" disabled={!answer.answer || generating} onClick={() => runAnswer("expand", lastQuestion)}><Maximize2 className="mr-1 h-3.5 w-3.5" />Expand</Button>
              <Button size="sm" variant="secondary" disabled={!answer.answer || generating} onClick={() => { setDraft(answer.answer); setEditing(true); }}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
              {generating && <Button size="sm" variant="ghost" onClick={() => { answerAbort.current?.abort(); setGenerating(false); }}><X className="mr-1 h-3.5 w-3.5" />Stop</Button>}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-card">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Key talking points</h2>
            {answer.points.length ? (
              <ul className="mt-3 space-y-2">
                {answer.points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{p}</li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">Talking points appear with each answer.</p>}
          </section>
        </div>

        {/* Transcript column */}
        <section className="flex max-h-[calc(100vh-170px)] min-h-96 flex-col rounded-xl border border-border bg-card shadow-card lg:sticky lg:top-5">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Live transcript</h2>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" className="accent-primary" checked={settings.autoDetect} onChange={(e) => updateSettings({ autoDetect: e.target.checked })} />
              Auto-detect questions
            </label>
          </div>
          <div className="flex-1 space-y-2 overflow-auto px-4 py-3">
            {lines.length === 0 && <p className="text-sm text-muted-foreground">{state === "idle" ? "Press Start listening to begin. Nothing is captured before that." : "Listening… words appear after each pause."}</p>}
            {lines.map((l, i) => (
              <div key={l.id} className={`group rounded-md px-2 py-1.5 text-sm ${i >= pendingFrom ? "bg-accent/40" : ""}`}>
                <span className="mr-2 font-mono text-[10px] text-muted-foreground">{new Date(l.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                {editLine === l.id ? (
                  <input
                    autoFocus
                    defaultValue={l.text}
                    className="w-full rounded bg-input px-1.5 py-1 text-sm outline-none ring-1 ring-ring"
                    onBlur={(e) => { const v = e.target.value; setLines((ls) => ls.map((x) => (x.id === l.id ? { ...x, text: v } : x))); setEditLine(null); }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <span onDoubleClick={() => setEditLine(l.id)} className="cursor-text">{l.text}
                    <button onClick={() => setEditLine(l.id)} className="ml-1 opacity-0 group-hover:opacity-100" aria-label="Edit line"><Pencil className="inline h-3 w-3 text-muted-foreground" /></button>
                  </span>
                )}
              </div>
            ))}
            <div ref={transcriptEnd} />
          </div>
          <div className="border-t border-border p-3">
            <Button className="w-full" variant="outline" disabled={generating || (!pendingText && !lines.length)} onClick={() => runAnswer("manual")}>
              <Sparkles className="mr-1 h-4 w-4" />Answer {pendingText ? "highlighted speech" : "last lines"}
            </Button>
          </div>
        </section>
      </div>

      {qas.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Interview summary · {qas.length} question{qas.length > 1 ? "s" : ""}</h2>
            <ExportButtons session={liveSession} />
          </div>
          <ol className="mt-3 divide-y divide-border">
            {qas.map((q, i) => (
              <li key={q.id} className="py-2 text-sm">
                {(i === 0 || (qas[i - 1].stage ?? 1) !== (q.stage ?? 1)) && stage > 1 && (
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Stage {q.stage ?? 1}</p>
                )}
                <button className="text-left hover:text-primary" onClick={() => { lastQaId.current = q.id; setAnswer({ noQuestion: false, question: q.question, subject: q.subject, answer: q.answer, points: q.points }); }}>
                  <span className="mr-2 font-mono text-xs text-muted-foreground">Q{i + 1}</span>{q.question}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <FloatingOverlay open={overlay} onClose={() => setOverlay(false)} width={compact ? 380 : 480} height={compact ? 240 : 460}>
        {overlayBody}
      </FloatingOverlay>
    </div>
  );
}

function LevelMeter({ level }: { level: number }) {
  const bars = 12;
  const v = Math.min(1, level * 12);
  return (
    <div className="flex h-5 items-end gap-0.5" aria-label="Input level">
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className={`w-1 rounded-sm transition-all ${i / bars < v ? "bg-primary" : "bg-muted"}`} style={{ height: `${30 + (i / bars) * 70}%` }} />
      ))}
    </div>
  );
}
