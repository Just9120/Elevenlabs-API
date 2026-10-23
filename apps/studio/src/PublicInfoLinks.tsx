export function PublicInfoLinks({ compact = false }: { compact?: boolean }) {
  return (
    <nav className="public-info-links" aria-label="Информация о приложении">
      <a href="/about.html">О приложении</a>
      {!compact && <a href="/privacy.html">Обработка данных</a>}
      {!compact && <a href="/terms.html">Правила использования</a>}
    </nav>
  );
}
