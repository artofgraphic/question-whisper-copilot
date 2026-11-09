import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearSessions, defaultSettings, loadSettings, saveSettings, type Settings } from "@/lib/store";
import { useAudioStatus } from "@/hooks/use-audio-status";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — A'wn Khafi" },
      { name: "description", content: "Audio input, microphone permission, AI answer preferences, theme and privacy." },
      { property: "og:title", content: "Settings — A'wn Khafi" },
      { property: "og:description", content: "Audio input, microphone permission, AI answer preferences, theme and privacy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Card({ title, children, desc }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="text-sm font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-xs text-muted-foreground">{desc}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const [s, setS] = useState<Settings>(defaultSettings);
  const { permission, devices, request } = useAudioStatus();
  useEffect(() => setS(loadSettings()), []);
  const set = (p: Partial<Settings>) => {
    const n = { ...s, ...p };
    setS(n);
    saveSettings(n);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card title="Audio input">
        <div className="grid gap-2">
          <Label>Source</Label>
          <Select value={s.source === "system" ? "system::" : `mic::${s.deviceId}`} onValueChange={(v) => { const [source, d] = v.split("::"); set({ source: source as Settings["source"], deviceId: d ?? "" }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mic::">Default microphone</SelectItem>
              {devices.filter((d) => d.deviceId && d.deviceId !== "default").map((d, i) => <SelectItem key={d.deviceId} value={`mic::${d.deviceId}`}>{d.label || `Microphone ${i + 1}`}</SelectItem>)}
              <SelectItem value="system::">Tab / system audio (share screen)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Tab/system audio uses screen sharing with “Share audio”. Chrome/Edge capture tab audio everywhere and full system audio on Windows; macOS browsers can only share tab audio.</p>
        </div>
        <div className="grid gap-2">
          <Label>Pause length that ends a phrase: {s.silenceMs} ms</Label>
          <input type="range" min={500} max={2000} step={100} value={s.silenceMs} onChange={(e) => set({ silenceMs: Number(e.target.value) })} className="accent-primary" />
        </div>
        <div className="grid gap-2">
          <Label>Spoken language (ISO code, empty = auto)</Label>
          <Input value={s.language} placeholder="e.g. en, ar" onChange={(e) => set({ language: e.target.value.trim() })} />
        </div>
      </Card>

      <Card title="Microphone permission">
        <div className="flex items-center justify-between">
          <p className="text-sm">Status: <span className="font-medium">{permission}</span></p>
          {permission !== "granted" && <Button size="sm" variant="outline" onClick={() => request().catch(() => toast.error("Permission was denied"))}>Request access</Button>}
        </div>
        {permission === "denied" && <p className="text-xs text-muted-foreground">Re-enable it from the lock icon in your browser's address bar.</p>}
      </Card>

      <Card title="AI response preferences">
        <div className="grid gap-2">
          <Label>Answer length</Label>
          <Select value={s.length} onValueChange={(v) => set({ length: v as Settings["length"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Short</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="long">Long</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Tone</Label>
          <Input value={s.tone} onChange={(e) => set({ tone: e.target.value })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>Automatically detect questions</Label>
          <Switch checked={s.autoDetect} onCheckedChange={(v) => set({ autoDetect: v })} />
        </div>
        <div className="grid gap-2">
          <Label>Your background (optional)</Label>
          <Textarea rows={4} value={s.profile} placeholder="Role, skills, real examples. The AI will only use facts written here for personal questions." onChange={(e) => set({ profile: e.target.value })} />
        </div>
      </Card>

      <Card title="Theme">
        <Select value={s.theme} onValueChange={(v) => set({ theme: v as Settings["theme"] })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="charcoal">Charcoal</SelectItem>
            <SelectItem value="midnight">Midnight (darker)</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card title="Privacy">
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          <li>Audio is only captured after you press Start, and the status light shows when listening is active.</li>
          <li>Short speech segments are sent to Lovable AI for transcription and then discarded; audio is never stored.</li>
          <li>Transcripts and answers are saved only in this browser, if history is on.</li>
          <li>Use A'wn Khafi only where AI assistance is permitted.</li>
        </ul>
        <div className="flex items-center justify-between">
          <Label>Save session history</Label>
          <Switch checked={s.saveHistory} onCheckedChange={(v) => set({ saveHistory: v })} />
        </div>
        <Button variant="destructive" size="sm" onClick={() => { clearSessions(); toast.success("History deleted"); }}>Delete all saved sessions</Button>
      </Card>
    </div>
  );
}
