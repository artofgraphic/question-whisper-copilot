import { useCallback, useEffect, useState } from "react";

export type MicPermission = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

export function useAudioStatus() {
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return setPermission("unsupported");
    try {
      const st = await navigator.permissions?.query({ name: "microphone" as PermissionName });
      if (st) {
        setPermission(st.state as MicPermission);
        st.onchange = () => setPermission(st.state as MicPermission);
      }
    } catch {
      setPermission("prompt");
    }
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list.filter((d) => d.kind === "audioinput"));
  }, []);

  useEffect(() => {
    refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const request = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    await refresh();
  }, [refresh]);

  return { permission, devices, refresh, request };
}
