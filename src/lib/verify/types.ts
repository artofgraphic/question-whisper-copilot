export type ClaimStatus = "supported" | "stale" | "contradicted" | "unverified" | "personal";
export const STATUS_LABEL: Record<ClaimStatus, string> = {
  supported: "Supported",
  stale: "Potentially Stale",
  contradicted: "Contradicted",
  unverified: "Unverified",
  personal: "Needs Personal Confirmation",
};
export type Evidence = { title: string; url: string; snippet: string; publishedDate?: string | null };
export type ClaimResult = {
  claim: string;
  category: "personal" | "factual" | "time_sensitive";
  status: ClaimStatus;
  reasoning: string;
  evidence: Evidence[];
};
export type VerificationReport = {
  checkedAt: number;
  overall: ClaimStatus;
  counts: Record<ClaimStatus, number>;
  claims: ClaimResult[];
  correctedAnswer?: string | null;
  error?: string | null;
};

/** Worst factual status wins; answers with only personal claims are "personal"; no claims => supported. */
export function overallStatus(claims: { status: ClaimStatus }[]): ClaimStatus {
  for (const s of ["contradicted", "stale", "unverified", "supported"] as const) if (claims.some((c) => c.status === s)) return s;
  return claims.length ? "personal" : "supported";
}
export function countStatuses(claims: { status: ClaimStatus }[]) {
  const c: Record<ClaimStatus, number> = { supported: 0, stale: 0, contradicted: 0, unverified: 0, personal: 0 };
  for (const x of claims) c[x.status]++;
  return c;
}
