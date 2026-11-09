import { createFileRoute } from "@tanstack/react-router";
import { transcribe } from "@/lib/ai/transcribe.server";

const MAX_BYTES = 10 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return Response.json({ error: "AI is not configured" }, { status: 500 });
        const len = Number(request.headers.get("content-length") ?? 0);
        if (len > MAX_BYTES + 64 * 1024) return Response.json({ error: "Audio segment too large" }, { status: 413 });
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Invalid upload" }, { status: 400 });
        }
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          return Response.json({ error: "Missing audio" }, { status: 400 });
        }
        const language = (form.get("language") as string | null) || undefined;
        try {
          const upstream = await transcribe(
            {
              baseURL: "https://ai.gateway.lovable.dev",
              apiKey,
              model: "openai/gpt-transcribe",
              maxFileBytes: MAX_BYTES,
              audioOnly: true,
            },
            new File([file], "segment.wav", { type: "audio/wav" }),
            { language, signal: request.signal },
          );
          return new Response(upstream.body, {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
          });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
