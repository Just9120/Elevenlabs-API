import { useEffect, useState } from "react";
import {
  REALTIME_CAPTION_CHANNEL,
  parseRealtimeCaptionMessage,
  type RealtimeCaptionMessage,
} from "./realtimeConsumers";
import "./styles.css";

export function RealtimeOverlay() {
  const [caption, setCaption] = useState<RealtimeCaptionMessage | null>(null);
  const supported = typeof BroadcastChannel !== "undefined";
  const projectId = new URLSearchParams(window.location.search).get("project") ?? "";

  useEffect(() => {
    if (!supported) return;
    const channel = new BroadcastChannel(REALTIME_CAPTION_CHANNEL);
    channel.onmessage = (event) => {
      const parsed = parseRealtimeCaptionMessage(event.data);
      if (parsed && projectId && parsed.project_id === projectId) setCaption(parsed);
    };
    return () => channel.close();
  }, [projectId, supported]);

  const lines = caption
    ? [...caption.committed, caption.partial].filter(Boolean).slice(-3)
    : [];
  return (
    <main className="realtime-overlay" aria-live="polite">
      {!projectId ? (
        <p>Откройте overlay из нужного проекта Studio.</p>
      ) : !supported ? (
        <p>Этот браузер не поддерживает независимый канал субтитров.</p>
      ) : lines.length ? (
        <div className="realtime-overlay-caption">{lines.join("\n")}</div>
      ) : (
        <p className="realtime-overlay-waiting">Ожидаем Live-субтитры…</p>
      )}
    </main>
  );
}
