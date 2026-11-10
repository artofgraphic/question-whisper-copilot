import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/routes/settings";
import { defaultSettings, loadSettings, saveSettings } from "@/lib/store";

vi.mock("@/hooks/use-audio-status", () => ({
  useAudioStatus: () => ({ permission: "granted", devices: [], request: vi.fn() }),
}));

beforeEach(() => {
  localStorage.clear();
  saveSettings({ ...defaultSettings, profile: "I am a designer." });
});
afterEach(cleanup);

describe("Saving the candidate background", () => {
  it("keeps edits out of saved answer preferences until Save is pressed", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Your background (optional)"), { target: { value: "I led a design team of five." } });
    expect(loadSettings().profile).toBe("I am a designer.");
    fireEvent.click(screen.getByRole("button", { name: "Save background" }));
    expect(loadSettings().profile).toBe("I led a design team of five.");
    cleanup();
    render(<SettingsPage />);
    expect(screen.getByLabelText("Your background (optional)")).toHaveValue("I led a design team of five.");
  });

  it("does not save a background draft when another preference changes", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Your background (optional)"), { target: { value: "Not saved yet" } });
    fireEvent.change(screen.getByDisplayValue(defaultSettings.tone), { target: { value: "Friendly" } });
    expect(loadSettings().tone).toBe("Friendly");
    expect(loadSettings().profile).toBe("I am a designer.");
  });
});