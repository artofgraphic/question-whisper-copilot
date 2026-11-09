import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PipApi = {
  requestWindow: (o: { width: number; height: number }) => Promise<Window>;
  window: Window | null;
};

export function pipSupported() {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
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
  children,
}: {
  open: boolean;
  onClose: () => void;
  width: number;
  height: number;
  children: ReactNode;
}) {
  const [win, setWin] = useState<Window | null>(null);

  useEffect(() => {
    if (!open) return;
    const api = (window as unknown as { documentPictureInPicture: PipApi }).documentPictureInPicture;
    let w: Window | null = null;
    let cancelled = false;
    api
      .requestWindow({ width, height })
      .then((pw) => {
        if (cancelled) return pw.close();
        w = pw;
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
          pw.document.head.appendChild(n.cloneNode(true));
        });
        pw.document.documentElement.dataset["theme"] = document.documentElement.dataset["theme"] ?? "";
        pw.document.title = "A'wn Khafi";
        pw.document.body.className = "bg-background text-foreground";
        pw.addEventListener("pagehide", () => {
          setWin(null);
          onClose();
        });
        setWin(pw);
      })
      .catch(() => onClose());
    return () => {
      cancelled = true;
      w?.close();
      setWin(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (win) {
      try {
        win.resizeTo(width, height);
      } catch {}
    }
  }, [win, width, height]);

  return win ? createPortal(children, win.document.body) : null;
}
