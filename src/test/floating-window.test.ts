import { afterEach, describe, expect, it, vi } from "vitest";
import { requestOverlayWindow } from "@/components/FloatingOverlay";

afterEach(() => { vi.restoreAllMocks(); delete (window as unknown as { documentPictureInPicture?: unknown }).documentPictureInPicture; });

describe("Floating-window compatibility", () => {
  it("requests picture-in-picture synchronously within the click", async () => {
    const requestWindow = vi.fn().mockResolvedValue(window);
    Object.defineProperty(window, "documentPictureInPicture", { configurable: true, value: { requestWindow } });
    const pending = requestOverlayWindow(380, 240);
    expect(requestWindow).toHaveBeenCalledWith({ width: 380, height: 240 });
    expect(await pending).toBe(window);
  });
  it("opens a popup when picture-in-picture is absent", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(window);
    expect(await requestOverlayWindow(380, 240)).toBe(window);
    expect(open).toHaveBeenCalledWith("", "awn-floating-overlay", "popup=yes,width=380,height=240");
  });
  it("reports a blocked popup", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    await expect(requestOverlayWindow(380, 240)).rejects.toThrow("blocked");
  });
});