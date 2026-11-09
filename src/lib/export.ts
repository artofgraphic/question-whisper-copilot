// Export a session's questions & answers as PDF (print dialog), Word (.doc) or share/copy as text.
import type { Session } from "./store";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function groups(s: Session) {
  const map = new Map<number, Session["qas"]>();
  for (const q of s.qas) {
    const st = q.stage ?? 1;
    map.set(st, [...(map.get(st) ?? []), q]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]);
}

export function sessionHtml(s: Session) {
  const multi = groups(s).length > 1;
  let n = 0;
  const body = groups(s)
    .map(([st, qs]) =>
      (multi ? `<h2>Stage ${st}</h2>` : "") +
      qs.map((q) => {
        n++;
        return `<div class="qa"><h3>Q${n}. ${esc(q.question)}</h3><p>${esc(q.answer).replace(/\n/g, "<br>")}</p>${
          q.points.length ? `<ul>${q.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""
        }</div>`;
      }).join(""),
    )
    .join("");
  return `<html><head><meta charset="utf-8"><title>Interview summary</title><style>
body{font-family:Georgia,serif;max-width:720px;margin:32px auto;color:#111;line-height:1.5}
h1{font-size:22px}h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:28px}
h3{font-size:14px;margin:18px 0 6px}.qa{page-break-inside:avoid}li{font-size:13px;color:#444}
</style></head><body><h1>Interview summary</h1><p>${new Date(s.startedAt).toLocaleString()} · ${s.qas.length} questions</p>${body}</body></html>`;
}

export function sessionText(s: Session) {
  return `Interview summary — ${new Date(s.startedAt).toLocaleString()}\n\n` +
    s.qas.map((q, i) => `Q${i + 1}${q.stage ? ` (stage ${q.stage})` : ""}: ${q.question}\nA: ${q.answer}`).join("\n\n");
}

export function downloadDoc(s: Session) {
  const blob = new Blob(["\ufeff", sessionHtml(s)], { type: "application/msword" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `interview-${new Date(s.startedAt).toISOString().slice(0, 10)}.doc`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadPdf(s: Session) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(sessionHtml(s));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

export async function shareSession(s: Session): Promise<"shared" | "copied"> {
  const text = sessionText(s);
  if (navigator.share) {
    try {
      await navigator.share({ title: "Interview summary", text });
      return "shared";
    } catch { /* fall through to copy */ }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
