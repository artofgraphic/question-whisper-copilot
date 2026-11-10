<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- AI calls live in server routes `src/routes/api/answer.ts` (Responses, streamed plain text with QUESTION/SUBJECT/ANSWER/POINTS markers parsed by `src/lib/answer.ts`) and `src/routes/api/transcribe.ts` (STT proxy) — keeps the API key server-side and lets the client stream.
- Audio capture + pause-based segmentation runs client-side in `src/lib/audio.ts`; settings/history persist in localStorage (`src/lib/store.ts`) — no backend auth needed; swap to Cloud later if cross-device history is required.
- Open floating windows directly from the user's click using Document Picture-in-Picture with a same-origin popup fallback; this preserves user activation and supports Electron without that browser API.
- Answer verification lives in `src/lib/verify/` (engine.server.ts: AI claim extraction → Tavily search → AI verdicts) behind `/api/verify`; reports attach to each QA in localStorage so session, overlay, history and exports share one engine.
