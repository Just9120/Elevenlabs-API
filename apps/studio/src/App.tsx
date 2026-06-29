import { useMemo, useState } from 'react';
import { Briefcase, ClipboardList, Home, PlusCircle, Settings } from 'lucide-react';
import { buildSegmentPlan, hasSegmentErrors, type Segment } from './segments';
import './styles.css';

const appUrl = import.meta.env.VITE_APP_PUBLIC_URL ?? 'https://studio.librechat.online';
type Page = 'dashboard' | 'projects' | 'new' | 'jobs' | 'settings';
const nav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Панель', icon: Home }, { id: 'projects', label: 'Проекты', icon: Briefcase },
  { id: 'new', label: 'Новая транскрибация', icon: PlusCircle }, { id: 'jobs', label: 'Задачи', icon: ClipboardList }, { id: 'settings', label: 'Настройки', icon: Settings },
];
const demoProjects = ['Интервью продукта — демо', 'Подкаст о локализации — демо', 'Исследование звонков — демо'];
const demoJobs = [{ title: 'Демо: ожидание серверной очереди', state: 'Прототип' }, { title: 'Демо: проверка сегментов', state: 'UI-only' }];

function NewTranscription() {
  const [file, setFile] = useState<File | null>(null);
  const [segments, setSegments] = useState<Segment[]>([{ id: crypto.randomUUID(), title: '', end: '' }]);
  const plan = useMemo(() => buildSegmentPlan(segments), [segments]);
  const invalid = hasSegmentErrors(segments);
  return <section className="card wide"><p className="eyebrow">Локально в браузере</p><h2>Новая транскрибация</h2>
    <p className="notice">Файл не загружается на сервер. Сейчас UI читает только имя, размер и тип файла; provider calls, Google Drive/Docs и серверные задачи появятся позже.</p>
    <label className="drop">Выберите audio/video файл<input type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
    {file && <dl className="meta"><dt>Файл</dt><dd>{file.name}</dd><dt>Размер</dt><dd>{(file.size / 1024 / 1024).toFixed(2)} MB</dd><dt>Тип</dt><dd>{file.type || 'не указан браузером'}</dd></dl>}
    <div className="builder"><h3>Сегменты будущих документов</h3>{segments.map((s, i) => <div className="segment" key={s.id}><strong>Часть {i + 1}</strong><label>Название Google Doc (прототип)<input value={s.title} onChange={(e) => setSegments(v => v.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))} placeholder={`Часть ${i + 1}`} /></label>{i < segments.length - 1 ? <label>Конец части<input value={s.end} onChange={(e) => setSegments(v => v.map(x => x.id === s.id ? { ...x, end: e.target.value } : x))} placeholder="MM:SS" aria-invalid={Boolean(plan[i]?.error)} /></label> : <span className="pill">До конца записи</span>}{segments.length > 1 && <button type="button" onClick={() => setSegments(v => v.filter(x => x.id !== s.id))}>Удалить</button>}{plan[i]?.error && <p className="error">{plan[i].error}</p>}</div>)}
    <button type="button" onClick={() => setSegments(v => [...v, { id: crypto.randomUUID(), title: '', end: '' }])}>Добавить часть</button></div>
    <ol className="timeline">{plan.map(p => <li key={p.index}><b>{p.title}</b><span>{p.start} → {p.endLabel}</span></li>)}</ol>
    <button className="primary" disabled={!file || invalid}>Подготовить черновик задачи</button>{invalid && <p className="error">Исправьте границы сегментов перед продолжением.</p>}
  </section>;
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  return <div className="shell"><aside><div className="brand">Studio PWA<span>UI foundation</span></div><nav>{nav.map(({ id, label, icon: Icon }) => <button className={page === id ? 'active' : ''} onClick={() => setPage(id)} key={id}><Icon size={18}/>{label}</button>)}</nav></aside><main>
    {page === 'dashboard' && <section className="hero"><p className="eyebrow">Русскоязычная Studio</p><h1>Панель готова к установке</h1><p>Это PWA-фундамент: аккуратный app shell, offline support и прототипы будущих сценариев без транскрибации и интеграций.</p><button className="primary" onClick={() => setPage('new')}>Создать черновик</button></section>}
    {page === 'projects' && <section className="grid"><h2>Проекты</h2>{demoProjects.map(p => <article className="card" key={p}><span className="tag">Демо-данные</span><h3>{p}</h3><p>Хранится только в клиентском прототипе, не связано с Drive или manifest.</p></article>)}</section>}
    {page === 'new' && <NewTranscription />}
    {page === 'jobs' && <section className="grid"><h2>Задачи</h2>{demoJobs.map(j => <article className="card" key={j.title}><span className="tag">{j.state}</span><h3>{j.title}</h3><p>Sample state. Реальная очередь и provider processing ещё не подключены.</p></article>)}</section>}
    {page === 'settings' && <section className="card wide"><h2>Настройки</h2><p>Публичный URL приложения:</p><code>{appUrl}</code><p className="notice">Секреты, provider keys и Google credentials здесь не отображаются и не требуются.</p></section>}
  </main></div>;
}
