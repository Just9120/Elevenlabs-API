/* global self */

self.addEventListener("push", (event) => {
  let kind = "job_failed";
  try {
    const payload = event.data ? event.data.json() : null;
    if (payload && payload.kind === "job_completed") kind = "job_completed";
  } catch {
    // A malformed remote payload is rendered as the generic failure notice.
  }
  const completed = kind === "job_completed";
  event.waitUntil(
    self.registration.showNotification(
      completed ? "Транскрибация готова" : "Транскрибация завершилась с ошибкой",
      {
        body: completed
          ? "Результат сохранён. Откройте VoiceOps Studio."
          : "Откройте VoiceOps Studio, чтобы посмотреть подробности.",
        data: { url: "/transcriptions" },
        tag: "voiceops-transcription-result",
      },
    ),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate("/transcriptions");
        return existing.focus();
      }
      return self.clients.openWindow("/transcriptions");
    }),
  );
});
