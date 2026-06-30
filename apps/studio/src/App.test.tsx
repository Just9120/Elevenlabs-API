import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { buildSegmentPlan, parseTimeToSeconds } from './segments';
const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) } as Response);
describe('Studio PWA', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/session')) return json({}, false, 401);
    if (url.endsWith('/api/auth/bootstrap-status')) return json({ bootstrap_required: false });
    if (url.endsWith('/api/auth/login-context')) return json({ login_csrf_token: 'login-csrf' });
    if (url.endsWith('/api/auth/login')) return json({ user: { email: 'user@example.com', role: 'admin' }, csrf_token: 'csrf' });
    if (url.endsWith('/api/credentials') && init?.method === 'POST') return json({ id: 'c1' });
    if (url.endsWith('/api/credentials')) return json({ credentials: [{ id: 'c1', provider: 'openai', label: 'main', status: 'active', masked_value: '••••1234', active_version: 1 }] });
    if (url.endsWith('/api/audit-events')) return json({ events: [{ id: 'e1', type: 'credential.created', created_at: new Date().toISOString() }] });
    return json({ ok: true });
  })); });
  it('uses login flow and renders authenticated settings without secret storage', async () => {
    render(<App />); await screen.findByRole('heading', { name: 'Вход' });
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com'); await userEvent.type(screen.getByLabelText('Пароль'), 'password'); await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await screen.findByText(/Панель аккаунта готова/); await userEvent.click(screen.getByRole('button', { name: /Настройки/ }));
    await screen.findByText(/BYOK credentials/); expect(screen.getByText(/••••1234/)).toBeInTheDocument(); expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
  });
  it('shows bootstrap-required operator instruction', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => url.endsWith('/api/auth/session') ? json({}, false, 401) : json({ bootstrap_required: true }));
    render(<App />); expect(await screen.findByText(/bootstrap-admin/)).toBeInTheDocument();
  });
  it('validates sequential segment boundaries', () => {
    expect(parseTimeToSeconds('01:05')).toBe(65);
    const plan = buildSegmentPlan([{ id: '1', title: '', end: '00:30' }, { id: '2', title: '', end: '00:20' }, { id: '3', title: '', end: '' }]);
    expect(plan[1].error).toMatch(/позже/); expect(plan[2].endLabel).toBe('До конца записи');
  });
});
