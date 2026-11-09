import { encodeWav } from "./wav";

export type ListenerState = "idle" | "listening" | "paused";

type Opts = {
  source: "mic" | "system";
  deviceId?: string | undefined;
  silenceMs: number;
  onSegment: (file: File) => void;
  onLevel: (rms: number, speaking: boolean) => void;
  onEnded: () => void;
};

const MAX_SEGMENT_SEC = 25;
const MIN_SPEECH_SEC = 0.5;

/**
 * Captures real audio (microphone or shared tab/system audio), runs a simple
 * energy-based voice activity detector and emits WAV segments at pauses.
 */
export class LiveListener {
  private stream?: MediaStream;
  private ctx?: AudioContext;
  private node?: ScriptProcessorNode;
  private src?: MediaStreamAudioSourceNode;
  private chunks: Float32Array[] = [];
  private speechSamples = 0;
  private silenceSamples = 0;
  private noise = 0.004;
  private paused = false;

  constructor(private opts: Opts) {}

  async start() {
    if (this.opts.source === "system") {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false } as MediaTrackConstraints,
      });
      const audio = display.getAudioTracks();
      display.getVideoTracks().forEach((t) => t.stop());
      if (!audio.length) {
        throw new Error(
          "No audio was shared. Choose a tab or screen and turn on “Share audio” in the browser dialog.",
        );
      }
      this.stream = new MediaStream(audio);
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: this.opts.deviceId ? { exact: this.opts.deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    }
    this.stream.getAudioTracks()[0]?.addEventListener("ended", () => this.opts.onEnded());

    this.ctx = new AudioContext();
    await this.ctx.resume();
    this.src = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    const rate = this.ctx.sampleRate;
    this.node.onaudioprocess = (e) => {
      if (this.paused) return;
      const data = new Float32Array(e.inputBuffer.getChannelData(0));
      let sum = 0;
      for (const v of data) sum += v * v;
      const rms = Math.sqrt(sum / data.length);
      const threshold = Math.max(0.012, this.noise * 3);
      const speaking = rms > threshold;
      if (!speaking) this.noise = this.noise * 0.95 + rms * 0.05;
      this.opts.onLevel(rms, speaking);

      if (speaking) {
        this.chunks.push(data);
        this.speechSamples += data.length;
        this.silenceSamples = 0;
      } else if (this.speechSamples > 0) {
        this.chunks.push(data);
        this.silenceSamples += data.length;
        if (this.silenceSamples / rate > this.opts.silenceMs / 1000) this.flush();
      }
      if (this.speechSamples / rate > MAX_SEGMENT_SEC) this.flush();
    };
    this.src.connect(this.node);
    this.node.connect(this.ctx.destination);
  }

  private flush() {
    const rate = this.ctx?.sampleRate ?? 48000;
    const enough = this.speechSamples / rate >= MIN_SPEECH_SEC;
    const chunks = this.chunks;
    this.chunks = [];
    this.speechSamples = 0;
    this.silenceSamples = 0;
    if (!enough) return;
    const down = downsample(chunks, rate, 16000);
    const blob = encodeWav([down], 16000);
    this.opts.onSegment(new File([blob], "segment.wav", { type: "audio/wav" }));
  }

  pause() {
    this.flush();
    this.paused = true;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = false));
  }
  resume() {
    this.paused = false;
    this.stream?.getAudioTracks().forEach((t) => (t.enabled = true));
  }
  async stop() {
    if (!this.paused) this.flush();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    this.src?.disconnect();
    if (this.node) this.node.onaudioprocess = null;
    await this.ctx?.close().catch(() => {});
  }
}

function downsample(chunks: Float32Array[], from: number, to: number): Float32Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const all = new Float32Array(len);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  if (from === to) return all;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(len / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(len, Math.floor((i + 1) * ratio));
    let s = 0;
    for (let j = start; j < end; j++) s += all[j];
    out[i] = s / Math.max(1, end - start);
  }
  return out;
}

/** Send one WAV segment to the server and return the final transcript text. */
export async function transcribeSegment(file: File, language: string, signal?: AbortSignal): Promise<string> {
  const { createParser } = await import("eventsource-parser");
  const form = new FormData();
  form.append("file", file);
  if (language) form.append("language", language);
  const res = await fetch("/api/transcribe", { method: "POST", body: form, signal });
  if (!res.ok || !res.body) {
    let msg = `Transcription failed (${res.status})`;
    try {
      const j = await res.json();
      msg = j.error?.message ?? j.error ?? j.message ?? msg;
    } catch {}
    throw new Error(typeof msg === "string" ? msg : "Transcription failed");
  }
  let text = "";
  let final: string | null = null;
  let err: string | null = null;
  const parser = createParser({
    onEvent(ev) {
      try {
        const d = JSON.parse(ev.data);
        if (d.type === "transcript.text.delta") text += d.delta ?? "";
        else if (d.type === "transcript.text.done") final = d.text ?? text;
        else if (d.type === "error" || d.error) err = d.error?.message ?? d.message ?? "Transcription error";
      } catch {}
    },
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(dec.decode(value, { stream: true }));
  }
  if (err) throw new Error(err);
  return (final ?? text).trim();
}
