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

const ORDER: ClaimStatus[] = ["contradicted", "stale", "unverified", "personal", "supported"];
/** Worst factual status wins; personal-only answers are "personal"; no claims => supported. */
export function overallStatus(claims: { status: ClaimStatus }[]): ClaimStatus {
  if (!claims.length) return "supported";
  for (const s of ORDER) if (claims.some((c) => c.status === s)) {
    if (s === "personal" || s === "unverified") {
      const factual = claims.filter((c) => c.status !== "personal");
      if (s === "personal") return factual.length ? "supported" : "personal";
    }
    return s;
  }
  return "supported";
}
export function countStatuses(claims: { status: ClaimStatus }[]) {
  const c: Record<ClaimStatus, number> = { supported: 0, stale: 0, contradicted: 0, unverified: 0, personal: 0 };
  for (const x of claims) c[x.status]++;
  return c;
}
