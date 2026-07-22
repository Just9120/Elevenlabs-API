import { type FormEvent, useEffect, useState } from "react";
import { api } from "./apiClient";

export type User = { email: string; role: string };

export function Login({
  onLogin,
}: {
  onLogin: (user: User, csrf: string) => void;
}) {
  const [bootstrap, setBootstrap] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ bootstrap_required: boolean }>("/auth/bootstrap-status")
      .then((response) => setBootstrap(response.bootstrap_required))
      .catch(() => setError("API временно недоступен."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const context = await api<{ login_csrf_token: string }>(
        "/auth/login-context",
        { method: "POST" },
      );
      const response = await api<{ user: User; csrf_token: string }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email: formData.get("email"),
            password: formData.get("password"),
            login_csrf_token: context.login_csrf_token,
          }),
        },
      );
      onLogin(response.user, response.csrf_token);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось войти.");
    }
  }

  if (bootstrap)
    return (
      <main className="auth">
        <section className="card">
          <h1>Требуется первичная настройка</h1>
          <p className="notice">
            Публичной формы администратора нет. Обратитесь к оператору, чтобы
            выполнить bootstrap-admin команду на сервере.
          </p>
        </section>
      </main>
    );

  return (
    <main className="auth">
      <form className="card login" onSubmit={submit}>
        <p className="eyebrow">Studio account</p>
        <h1>Вход</h1>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Пароль
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button className="primary">Войти</button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  );
}
