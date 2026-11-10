import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PipApi = {
  requestWindow: (o: { width: number; height: number }) => Promise<Window>;
  window: Window | null;
};

/** Must run directly in the click handler, before React effects lose user activation. */
export function requestOverlayWindow(width: number, height: number): Promise<Window> {
  const api = (window as unknown as { documentPictureInPicture?: PipApi }).documentPictureInPicture;
  // Embedded previews expose the API but prohibit using it inside their frame.
  if (api && window.self === window.top) return api.requestWindow({ width, height });
  const popup = window.open("", "awn-floating-overlay", `popup=yes,width=${width},height=${height}`);
  if (!popup) return Promise.reject(new Error("The floating window was blocked. Allow pop-up windows for this app."));
  return Promise.resolve(popup);
}

/**
 * Real always-on-top floating window using the browser's Document Picture-in-Picture API
 * (Chrome/Edge 116+). It floats above Zoom, Meet, Teams, etc., and is movable and resizable.
 */
export function FloatingOverlay({
  open,
  onClose,
  width,
  height,
  targetWindow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width: number;
  height: number;
  targetWindow: Window | null;
  children: ReactNode;
}) {
  const [win, setWin] = useState<Window | null>(null);

  useEffect(() => {
    if (!open || !targetWindow) return;
    const pw = targetWindow;
    const base = pw.document.createElement("base");
    base.href = document.baseURI;
    pw.document.head.prepend(base);
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
          pw.document.head.appendChild(n.cloneNode(true));
        });
        // Inline loaded rules too: preview stylesheet links may rely on the parent frame's loader.
        Array.from(document.styleSheets).forEach((sheet) => {
          try {
            const style = pw.document.createElement("style");
            style.textContent = Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
            pw.document.head.appendChild(style);
          } catch { /* Cross-origin font stylesheets remain linked above. */ }
        });
        pw.document.documentElement.dataset["theme"] = document.documentElement.dataset["theme"] ?? "";
        pw.document.title = "A'wn Khafi";
        pw.document.body.className = "bg-background text-foreground";
        const closed = () => {
          setWin(null);
          onClose();
        };
        pw.addEventListener("pagehide", closed);
        const poll = setInterval(() => { if (pw.closed) closed(); }, 500);
        setWin(pw);
    return () => {
      clearInterval(poll);
      pw.removeEventListener("pagehide", closed);
      pw.close();
      setWin(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetWindow]);

  useEffect(() => {
    if (win) {
      try {
        win.resizeTo(width, height);
      } catch {}
    }
  }, [win, width, height]);

  return win ? createPortal(children, win.document.body) : null;
}
