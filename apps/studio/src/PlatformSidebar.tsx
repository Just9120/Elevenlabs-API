import { AudioLines, Home, Settings, SlidersHorizontal } from "lucide-react";
import type { Page } from "./platformRouting";

const platformNav: { id: Page; label: string; icon: typeof Home }[] = [
  { id: "dashboard", label: "Обзор", icon: Home },
  { id: "audio", label: "Обработка аудио", icon: SlidersHorizontal },
  { id: "projects", label: "Транскрибации", icon: AudioLines },
  { id: "settings", label: "Настройки", icon: Settings },
];

export function PlatformSidebar({
  page,
  onNavigate,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside className="app-sidebar">
      <div className="brand">
        Studio PWA<span>Транскрибация</span>
      </div>
      <nav className="app-nav" aria-label="Основная навигация">
        {platformNav.map(({ id, label, icon: Icon }) => (
          <button
            className={page === id ? "active" : ""}
            aria-current={page === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
            key={id}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
