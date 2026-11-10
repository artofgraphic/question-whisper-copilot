import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { countStatuses, overallStatus, type ClaimResult, type Evidence, type VerificationReport } from "./types";

type Extracted = { claim: string; category: "personal" | "factual" | "time_sensitive"; query: string };

function provider(apiKey: string) {
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
}

async function askJson<T>(apiKey: string, instructions: string, input: string, signal?: AbortSignal): Promise<T> {
  const r = streamText({
    model: provider(apiKey).responses("openai/gpt-6-astra"),
    instructions,
    messages: [{ role: "user", content: input }],
    ...(signal ? { abortSignal: signal } : {}),
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
  });
  const text = await r.text;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI returned no JSON");
  return JSON.parse(m[0]) as T;
}

async function tavily(query: string, key: string): Promise<Evidence[]> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15000);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: "advanced", max_results: 4, topic: "general" }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Search failed (${res.status})`);
    const j = (await res.json()) as { results?: { title: string; url: string; content: string; published_date?: string }[] };
    return (j.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 500), publishedDate: r.published_date ?? null }));
  } finally {
    clearTimeout(t);
  }
}

export async function verifyAnswer(o: { question: string; answer: string; profile?: string | undefined; apiKey: string; tavilyKey: string; signal?: AbortSignal }): Promise<VerificationReport> {
  const today = new Date().toISOString().slice(0, 10);
  const ex = await askJson<{ claims: Extracted[] }>(
    o.apiKey,
    `Extract up to 6 atomic, checkable claims from an interview answer. Today is ${today}.
category: "personal" = about the candidate's own experience, skills, history, opinions or placeholders like [your example]; "time_sensitive" = versions, prices, latest releases, current leaders, recent stats, years; "factual" = other general facts.
For non-personal claims write a concise web search query. Skip pure opinions/advice with no factual content.
Output only JSON: {"claims":[{"claim":"...","category":"...","query":"..."}]}`,
    `Question: ${o.question}\n\nAnswer:\n${o.answer}`,
    o.signal,
  );
  const claims = (ex.claims ?? []).slice(0, 6);
  const results: ClaimResult[] = [];
  const toCheck: { idx: number; c: Extracted; ev: Evidence[]; err?: string }[] = [];
  await Promise.all(
    claims.map(async (c, idx) => {
      if (c.category === "personal") {
        results[idx] = { claim: c.claim, category: "personal", status: "personal", reasoning: "This is about you — only you can confirm it. Not searched on the web.", evidence: [] };
        return;
      }
      try {
        toCheck.push({ idx, c, ev: await tavily(c.query || c.claim, o.tavilyKey) });
      } catch (e) {
        toCheck.push({ idx, c, ev: [], err: (e as Error).message });
      }
    }),
  );

  let corrected: string | null = null;
  const withEv = toCheck.filter((x) => x.ev.length);
  for (const x of toCheck.filter((x) => !x.ev.length))
    results[x.idx] = { claim: x.c.claim, category: x.c.category, status: "unverified", reasoning: x.err ? `Live search failed: ${x.err}` : "No relevant sources found.", evidence: [] };

  if (withEv.length) {
    const evBlock = withEv
      .map((x, i) => `CLAIM ${i}: ${x.c.claim}\n` + x.ev.map((e, j) => `  [${i}.${j}] ${e.title} (${e.publishedDate ?? "date unknown"}) ${e.url}\n  ${e.snippet}`).join("\n"))
      .join("\n\n");
    const judged = await askJson<{ verdicts: { i: number; status: string; reasoning: string; sources: number[] }[]; corrected_answer: string | null }>(
      o.apiKey,
      `You verify claims against live web evidence. Today is ${today}.
For each claim pick status: "supported" (evidence agrees and is current), "stale" (was true but superseded — older version, past year, outdated price/leader/release), "contradicted" (evidence says it's false), "unverified" (evidence insufficient). Give 1-2 sentence reasoning citing source dates. "sources" = indices j of the evidence used for that claim.
If any claim is stale or contradicted, write corrected_answer: the full answer rewritten to be accurate and speakable, with inline citations like [1], [2] where numbers refer to the order of URLs you list at the end as "Sources: [1] url". Use ONLY URLs from the evidence. Otherwise corrected_answer = null.
Output only JSON: {"verdicts":[{"i":0,"status":"...","reasoning":"...","sources":[0]}],"corrected_answer":null}`,
      `Original answer:\n${o.answer}\n\n${evBlock}`,
      o.signal,
    );
    const allowed = new Set(withEv.flatMap((x) => x.ev.map((e) => e.url)));
    withEv.forEach((x, i) => {
      const v = judged.verdicts?.find((d) => d.i === i);
      const st = (["supported", "stale", "contradicted", "unverified"] as const).find((s) => s === v?.status) ?? "unverified";
      const used = (v?.sources ?? []).map((j) => x.ev[j]).filter((e): e is Evidence => !!e);
      results[x.idx] = { claim: x.c.claim, category: x.c.category, status: st, reasoning: v?.reasoning ?? "No verdict returned.", evidence: used.length ? used : x.ev.slice(0, 2) };
    });
    // Drop corrected answers that cite URLs not present in the retrieved evidence.
    const c = judged.corrected_answer;
    if (c && (c.match(/https?:\/\/[^\s)\]]+/g) ?? []).every((u) => allowed.has(u.replace(/[.,;]+$/, "")))) corrected = c;
  }
  const final = results.filter(Boolean);
  return { checkedAt: Date.now(), overall: overallStatus(final), counts: countStatuses(final), claims: final, correctedAnswer: corrected };
}
