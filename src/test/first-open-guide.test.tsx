import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Render Home on its own: a full router run needs the loaders and stylesheets jsdom never loads.
vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");
  return {
    createFileRoute: () => (options: unknown) => options,
    Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement("a", { href: to }, children),
  };
});

vi.mock("@/hooks/use-audio-status", () => ({
  useAudioStatus: () => ({ permission: "granted", devices: [], request: vi.fn() }),
}));

import { Home } from "@/routes/index";
import { SettingsPage } from "@/routes/settings";
import { defaultSettings, loadSettings, saveSettings } from "@/lib/store";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("First-open guide", () => {
  it("shows how it works when nobody has opened the app before", async () => {
    expect(loadSettings().seenHowItWorks).toBe(false);
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument());
    expect(screen.getByText("Pick what to listen to")).toBeInTheDocument();
    expect(screen.getByText("Answers get fact-checked")).toBeInTheDocument();
  });

  it("stays hidden once dismissed and comes back only when asked for", async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "How it works" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Got it — don't show again" }));
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();
    expect(loadSettings().seenHowItWorks).toBe(true);
    cleanup();

    render(<Home />);
    await waitFor(() => expect(screen.getByText("Audio status")).toBeInTheDocument());
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
