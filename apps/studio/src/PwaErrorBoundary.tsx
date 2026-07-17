import { Component, type ReactNode } from "react";
import { emitPwaDiagnostic } from "./pwaDiagnostics";

export class PwaErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  private reported = false;
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    if (this.reported) return;
    this.reported = true;
    emitPwaDiagnostic("PWA_APP_ERROR", { boundary: "react_boundary", error_code: "app_error", retryable: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="auth pwa-error-fallback">
        <section className="card" role="alert">
          <h1>Приложение временно недоступно</h1>
          <p>Мы сохранили безопасный диагностический сигнал без деталей ошибки. Обновите страницу и продолжите работу.</p>
          <button type="button" className="primary" onClick={() => window.location.reload()}>Обновить страницу</button>
        </section>
      </main>
    );
  }
}
