import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { SettingsPage } from "@/routes/settings";
import { defaultSettings, loadSettings, saveSettings } from "@/lib/store";

vi.mock("@/hooks/use-audio-status", () => ({
  useAudioStatus: () => ({ permission: "granted", devices: [], request: vi.fn() }),
}));

function renderHome() {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("First-open guide", () => {
  it("shows how it works when nobody has opened the app before", async () => {
    expect(loadSettings().seenHowItWorks).toBe(false);
    renderHome();
    await waitFor(() => expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument());
    expect(screen.getByText("Pick what to listen to")).toBeInTheDocument();
    expect(screen.getByText("Answers get fact-checked")).toBeInTheDocument();
  });

  it("stays hidden after it is dismissed, and comes back only when asked for", async () => {
    renderHome();
    await waitFor(() => expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Got it — don't show again" }));
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();
    expect(loadSettings().seenHowItWorks).toBe(true);
    cleanup();

    renderHome();
    await waitFor(() => expect(screen.getByRole("link", { name: /Start Live Session/i })).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();

    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Show “How it works” on Home" }));
    expect(loadSettings().seenHowItWorks).toBe(false);
  });

  it("keeps the guide hidden for people who set their own preferences before this existed", () => {
    saveSettings({ ...defaultSettings, tone: "Friendly", seenHowItWorks: true });
    expect(loadSettings().seenHowItWorks).toBe(true);
  });
});
