import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { PwaErrorBoundary } from "./PwaErrorBoundary";
import { emitPwaServiceWorkerError, installPwaGlobalErrorHandlers } from "./pwaDiagnostics";

let pwaRuntimeInitialized = false;
let appRendered = false;

export function initializePwaRuntime(enableServiceWorker = import.meta.env.PROD && "serviceWorker" in navigator) {
  installPwaGlobalErrorHandlers();
  if (pwaRuntimeInitialized || !enableServiceWorker) return;
  pwaRuntimeInitialized = true;
  registerSW({ immediate: true, onRegisterError: () => emitPwaServiceWorkerError() });
  navigator.serviceWorker?.addEventListener?.("messageerror", () => emitPwaServiceWorkerError());
}

export function renderStudioApp() {
  if (appRendered) return;
  const root = document.getElementById("root");
  if (!root) return;
  appRendered = true;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <PwaErrorBoundary>
        <App />
      </PwaErrorBoundary>
    </React.StrictMode>,
  );
}

initializePwaRuntime();
renderStudioApp();
