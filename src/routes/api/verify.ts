import { createFileRoute } from "@tanstack/react-router";
import { verifyAnswer } from "@/lib/verify/engine.server";

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        const tavilyKey = process.env["TAVILY_API_KEY"];
        if (!apiKey || !tavilyKey) return Response.json({ error: "Verification is not configured" }, { status: 500 });
        let b: { question?: string; answer?: string; profile?: string };
        try { b = await request.json(); } catch { return Response.json({ error: "Invalid request" }, { status: 400 }); }
        const answer = (b.answer ?? "").slice(0, 4000).trim();
        if (!answer) return Response.json({ error: "No answer to verify" }, { status: 400 });
        try {
          const r = await verifyAnswer({ question: (b.question ?? "").slice(0, 500), answer, profile: b.profile, apiKey, tavilyKey, signal: request.signal });
          return Response.json(r);
        } catch (e) {
          const err = e as { statusCode?: number; message?: string };
          const status = err.statusCode === 402 || err.statusCode === 429 ? err.statusCode : 502;
          return Response.json({ error: err.statusCode === 402 ? "AI credits are used up." : err.statusCode === 429 ? "Too many requests — try again shortly." : err.message ?? "Verification failed" }, { status });
        }
      },
    },
  },
});
