import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { buildSegmentPlan, parseTimeToSeconds } from './segments';

describe('Studio PWA', () => {
  it('renders Russian navigation and settings public URL without secrets', async () => {
    render(<App />);
    expect(screen.getByText('Панель готова к установке')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Настройки/ }));
    expect(screen.getByText('https://studio.librechat.online')).toBeInTheDocument();
    expect(screen.queryByText(/API_KEY|SECRET|TOKEN/)).not.toBeInTheDocument();
  });
  it('validates sequential segment boundaries', () => {
    expect(parseTimeToSeconds('01:05')).toBe(65);
    const plan = buildSegmentPlan([{ id: '1', title: '', end: '00:30' }, { id: '2', title: '', end: '00:20' }, { id: '3', title: '', end: '' }]);
    expect(plan[0].start).toBe('00:00');
    expect(plan[1].error).toMatch(/позже/);
    expect(plan[2].endLabel).toBe('До конца записи');
  });
});
