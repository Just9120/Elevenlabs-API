import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "./apiClient";

export function PasswordResetPanel({ onReset }: { onReset?: () => void } = {}) {
  const [token, setToken] = useState(() => {
    const match = /^#password-reset=([A-Za-z0-9_-]{32,128})$/.exec(window.location.hash);
    return match?.[1] ?? "";
  });
  const [open, setOpen] = useState(Boolean(token));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (token) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true); setError(""); setMessage("");
    try {
      if (token) {
        await api("/auth/password-reset/confirm", { method: "POST", signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({ token, new_password: String(data.get("password") ?? "") }) });
        setToken(""); setMessage("Пароль изменён. Войдите с новым паролем; прежние сессии завершены.");
        onReset?.();
      } else {
        const result = await api<{ delivery: string }>("/auth/password-reset/request", { method: "POST", signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({ email: String(data.get("email") ?? "") }) });
        setMessage(result.delivery === "configured"
          ? "Если аккаунт существует, письмо отправлено в очередь. Проверьте почту и папку спама. Ссылка действует 15 минут."
          : "Почтовое восстановление пока не настроено оператором Studio. Обратитесь к владельцу сервиса.");
      }
    } catch (reason) {
      setError(reason instanceof ApiError && reason.status === 422
        ? "Ссылка недействительна или устарела. Запросите новое письмо."
        : "Не удалось выполнить запрос. Проверьте соединение и повторите позже.");
    } finally { setPending(false); }
  }
  return <section className="card login">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>Забыли пароль?</button>
    {open && <form onSubmit={submit} aria-label="Восстановление доступа">
      <h2>{token ? "Новый пароль" : "Восстановление доступа"}</h2>
      {token ? <label>Новый пароль<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={1024} required /></label>
        : <label>Email аккаунта<input name="email" type="email" autoComplete="username" required /></label>}
      <button type="submit" className="primary" disabled={pending}>{pending ? "Отправляем…" : token ? "Изменить пароль" : "Получить письмо"}</button>
      {token && <button type="button" disabled={pending} onClick={() => { setToken(""); setError(""); }}>Запросить новую ссылку</button>}
    </form>}
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
  </section>;
}
