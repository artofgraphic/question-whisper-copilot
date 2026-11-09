// Browser-local persistence for settings and session history (no audio is ever stored).
export type Settings = {
  deviceId: string;
  source: "mic" | "system";
  language: string;
  autoDetect: boolean;
  length: "short" | "medium" | "long";
  tone: string;
  profile: string;
  saveHistory: boolean;
  theme: "charcoal" | "midnight";
  silenceMs: number;
};

export const defaultSettings: Settings = {
  deviceId: "",
  source: "mic",
  language: "",
  autoDetect: true,
  length: "medium",
  tone: "confident and natural",
  profile: "",
  saveHistory: true,
  theme: "charcoal",
  silenceMs: 900,
};

export const lengthLabel: Record<Settings["length"], string> = {
  short: "short (40-70 words)",
  medium: "medium (80-140 words)",
  long: "long (150-220 words)",
};

export type QA = {
  id: string;
  at: number;
  question: string;
  subject: string;
  answer: string;
  points: string[];
  stage?: number;
};

export type TranscriptLine = { id: string; at: number; text: string };

export type Session = {
  id: string;
  startedAt: number;
  endedAt?: number;
  transcript: TranscriptLine[];
  qas: QA[];
};

const SK = "awn.settings";
const HK = "awn.sessions";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SK) || "{}") };
  } catch {
    return defaultSettings;
  }
}
export function saveSettings(s: Settings) {
  localStorage.setItem(SK, JSON.stringify(s));
  applyTheme(s.theme);
}
export function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset["theme"] = theme;
}

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HK) || "[]");
  } catch {
    return [];
  }
}
export function saveSession(s: Session) {
  const all = loadSessions().filter((x) => x.id !== s.id);
  all.unshift(s);
  localStorage.setItem(HK, JSON.stringify(all.slice(0, 100)));
}
export function deleteSession(id: string) {
  localStorage.setItem(HK, JSON.stringify(loadSessions().filter((x) => x.id !== id)));
}
export function clearSessions() {
  localStorage.removeItem(HK);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
