import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { PwaErrorBoundary } from "./PwaErrorBoundary";
import { emitPwaServiceWorkerError, installPwaGlobalErrorHandlers } from "./pwaDiagnostics";

installPwaGlobalErrorHandlers();

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  registerSW({ immediate: true, onRegisterError: () => emitPwaServiceWorkerError() });
  navigator.serviceWorker?.addEventListener?.("messageerror", () => emitPwaServiceWorkerError());
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PwaErrorBoundary>
      <App />
    </PwaErrorBoundary>
  </React.StrictMode>,
);
