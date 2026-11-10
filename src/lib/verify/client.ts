import type { VerificationReport } from "./types";
export async function requestVerification(body: { question: string; answer: string; profile?: string }, signal?: AbortSignal): Promise<VerificationReport> {
  const res = await fetch("/api/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? `Verification failed (${res.status})`);
  return j as VerificationReport;
}
