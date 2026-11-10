export type ParsedAnswer = {
  noQuestion: boolean;
  question: string;
  subject: string;
  answer: string;
  points: string[];
  error?: string | undefined;
};

/** Parse the (possibly partial) structured stream from /api/answer. */
export function parseAnswer(raw: string): ParsedAnswer {
  let text = raw;
  let error: string | undefined;
  const ei = text.indexOf("[[ERROR]]");
  if (ei >= 0) {
    error = text.slice(ei + 9).trim();
    text = text.slice(0, ei);
  }
  const t = text.trim();
  if (t.startsWith("NO_QUESTION")) return { noQuestion: true, question: "", subject: "", answer: "", points: [], error };
  const q = /QUESTION:\s*(.*)/.exec(t)?.[1]?.trim() ?? "";
  const s = /SUBJECT:\s*(.*)/.exec(t)?.[1]?.trim() ?? "";
  const ai = t.indexOf("ANSWER:");
  const pi = t.indexOf("POINTS:");
  const answer = ai >= 0 ? t.slice(ai + 7, pi >= 0 ? pi : undefined).trim() : "";
  const points =
    pi >= 0
      ? t
          .slice(pi + 7)
          .split("\n")
          .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
          .filter(Boolean)
      : [];
  return { noQuestion: false, question: q, subject: s, answer, points, error };
}

const QWORDS =
  /\b(what|why|how|when|where|who|which|tell|describe|explain|walk|give|talk|share|define|compare|imagine|suppose)\b|\b(can|could|would|will|do|does|did|is|are|should|have|has)\s+(you|we|your|the|a|an|it|there)\b/i;

/** Cheap local heuristic to decide whether pending speech is worth sending to the AI. */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim();
  if (t.split(/\s+/).length < 2) return false;
  if (/\?\s*$/.test(t)) return true;
  const sentences = t.split(/(?<=[.!?])\s+/);
  return sentences.some((s) => QWORDS.test(s.trim()) || /\?/.test(s));
}

export async function streamAnswer(
  body: unknown,
  onText: (raw: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `AI request failed (${res.status})`;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let raw = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
    onText(raw);
  }
  return raw;
}
