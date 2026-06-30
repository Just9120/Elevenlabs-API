import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { buildSegmentPlan, parseTimeToSeconds } from './segments';
const json = (body: unknown, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) } as Response);
function renderApp(mode: 'static' | 'platform') {
  render(<App mode={mode} />);
}
describe('Studio PWA', () => {
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/api/auth/session')) return json({ authenticated: true, user: { email: 'user@example.com', role: 'admin' } });
    if (url.endsWith('/api/auth/csrf')) return json({ csrf_token: 'csrf-after-refresh', user: { email: 'user@example.com', role: 'admin' } });
    if (url.endsWith('/api/auth/bootstrap-status')) return json({ bootstrap_required: false });
    if (url.endsWith('/api/auth/login-context')) return json({ login_csrf_token: 'login-csrf' });
    if (url.endsWith('/api/auth/login')) return json({ user: { email: 'user@example.com', role: 'admin' }, csrf_token: 'csrf' });
    if (url.endsWith('/api/credentials') && init?.method === 'POST') return json({ id: 'c1' });
    if (url.endsWith('/replace')) return json({ ok: true });
    if (url.endsWith('/api/credentials')) return json({ credentials: [{ id: 'c1', provider: 'openai', label: 'main', status: 'active', masked_value: '••••1234', active_version: 1 }] });
    if (url.endsWith('/api/audit-events')) return json({ events: [{ id: 'e1', type: 'credential.created', created_at: new Date().toISOString() }] });
    return json({ ok: true });
  })); });
  it('static-only mode renders public UI and makes no /api requests', async () => {
    renderApp('static');
    expect(screen.getByText('Панель готова к установке')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /Настройки/ }));
    expect(screen.getByText(/Статический режим/)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('platform mode refreshes in-memory CSRF and renders settings without browser storage secrets', async () => {
    renderApp('platform');
    await screen.findByText(/Панель аккаунта готова/);
    expect(fetch).toHaveBeenCalledWith('/api/auth/csrf', expect.objectContaining({ method: 'POST' }));
    await userEvent.click(screen.getByRole('button', { name: /Настройки/ }));
    await screen.findByText(/BYOK credentials/); expect(screen.getByText(/••••1234/)).toBeInTheDocument(); expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
  });
  it('platform mode supports credential replacement without rendering raw key', async () => {
    renderApp('platform'); await userEvent.click(await screen.findByRole('button', { name: /Настройки/ }));
    const replaceForm = await screen.findByLabelText('Заменить credential');
    await userEvent.selectOptions(replaceForm.querySelector('select')!, 'c1');
    await userEvent.type(screen.getByPlaceholderText('Новый ключ для замены'), 'raw-secret-never-render');
    await userEvent.click(screen.getByRole('button', { name: 'Заменить' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/credentials/c1/replace', expect.anything()));
    expect(screen.queryByText('raw-secret-never-render')).not.toBeInTheDocument();
  });
  it('shows bootstrap-required operator instruction', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => url.endsWith('/api/auth/session') ? json({}, false, 401) : json({ bootstrap_required: true }));
    renderApp('platform'); expect(await screen.findByText(/bootstrap-admin/)).toBeInTheDocument();
  });
  it('validates sequential segment boundaries', () => {
    expect(parseTimeToSeconds('01:05')).toBe(65);
    const plan = buildSegmentPlan([{ id: '1', title: '', end: '00:30' }, { id: '2', title: '', end: '00:20' }, { id: '3', title: '', end: '' }]);
    expect(plan[1].error).toMatch(/позже/); expect(plan[2].endLabel).toBe('До конца записи');
  });
});
