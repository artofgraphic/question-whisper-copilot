import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "@/lib/ai/run-id.server";

type Body = {
  text: string;
  context?: string;
  mode?: "auto" | "manual" | "regenerate" | "shorter" | "expand";
  previous?: string;
  prefs?: { length?: string; tone?: string; profile?: string };
};

const INSTRUCTIONS = `You are A'wn Khafi, a real-time interview copilot. You receive speech-to-text from an interviewer (may contain recognition errors). Your job: find the question being asked and write an answer the candidate can read and say aloud.

Rules:
- Answer across any subject: technology, software, product, business, analytics, general knowledge, behavioral.
- Use general knowledge and sound reasoning. Never invent statistics, facts, citations, or personal achievements. For behavioral questions, give a structure (e.g. STAR) with clearly marked placeholders like [your example] unless the candidate profile supplies details.
- If you are uncertain, say so briefly in the answer. If the question needs current/live information, state that you have no live data source and answer only with what is reliably known.
- Answer natural, conversational, professional, speakable. No markdown headings, no bold.

Output EXACTLY this format, nothing else:
QUESTION: <the clean, corrected question in one sentence>
SUBJECT: <short subject label>
ANSWER:
<the spoken answer>
POINTS:
- <key talking point>
- <key talking point>
- <key talking point>

If the text contains no real question or request directed at the candidate, output only: NO_QUESTION`;

export const Route = createFileRoute("/api/answer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "AI is not configured" }, { status: 500 });
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        const text = (body.text ?? "").slice(0, 4000).trim();
        if (!text) return Response.json({ error: "No text" }, { status: 400 });

        const lengthHint =
          body.mode === "shorter"
            ? "Make the answer noticeably shorter (2-3 sentences) than the previous one."
            : body.mode === "expand"
              ? "Expand the previous answer with more depth, an example, and nuance (about 180-250 words)."
              : body.mode === "regenerate"
                ? "Write a fresh alternative answer, different wording and angle from the previous one."
                : `Target length: ${body.prefs?.length ?? "medium (80-140 words)"}.`;

        const userMsg = [
          body.prefs?.profile ? `Candidate profile (only use facts stated here):\n${body.prefs.profile.slice(0, 2000)}` : "",
          body.context ? `Earlier conversation:\n${body.context.slice(-1500)}` : "",
          `Interviewer said:\n"""${text}"""`,
          body.previous ? `Previous suggested answer:\n${body.previous.slice(0, 3000)}` : "",
          `Tone: ${body.prefs?.tone ?? "confident and natural"}. ${lengthHint}`,
          body.mode === "manual" || body.mode === "regenerate" || body.mode === "shorter" || body.mode === "expand"
            ? "The user explicitly asked for an answer: treat the text as the question even if it is phrased as a statement."
            : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        let upstreamError: { status?: number; message: string } | null = null;
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          instructions: INSTRUCTIONS,
          messages: [{ role: "user", content: userMsg }],
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
          onError: ({ error }) => {
            const e = error as { statusCode?: number; message?: string };
            upstreamError = { status: e.statusCode, message: e.message ?? "AI request failed" };
          },
        });

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of result.textStream) controller.enqueue(encoder.encode(chunk));
              const err = upstreamError as { status?: number; message: string } | null;
              if (err) {
                const msg =
                  err.status === 402
                    ? "AI credits are used up. Add credits in Settings → Plans & credits."
                    : err.status === 429
                      ? "Too many requests right now. Wait a moment and try again."
                      : err.message;
                controller.enqueue(encoder.encode(`\n[[ERROR]]${msg}`));
              }
              controller.close();
            } catch (e) {
              if (!request.signal.aborted) controller.enqueue(encoder.encode(`\n[[ERROR]]${(e as Error).message}`));
              controller.close();
            }
          },
        });
        return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
      },
    },
  },
});
