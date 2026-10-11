import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { isSafeDisplayUrl } from "./resourceLinks";

export type ActionMenuItem = {
  id: string;
  label: string;
  onSelect?: () => void;
  href?: string;
  disabled?: boolean;
  danger?: boolean;
};

export function ActionMenu({ label, items, disabled = false }: {
  label: string;
  items: ActionMenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [alignLeft, setAlignLeft] = useState(false);
  const [above, setAbove] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const show = () => {
    const edge = trigger.current?.getBoundingClientRect().right ?? 0;
    setAlignLeft(edge < Math.min(280, window.innerWidth - 32) + 8);
    setOpen(true);
  };
  const close = (restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (!open || !menu.current || !trigger.current) return;
    const triggerBounds = trigger.current.getBoundingClientRect();
    const height = menu.current.getBoundingClientRect().height;
    setAbove(window.innerHeight - triggerBounds.bottom < height + 8 && triggerBounds.top > height + 8);
  }, [open, items]);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div className="action-menu" ref={root} onBlur={(event) => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="secondary action-menu-trigger"
      aria-label={label} aria-haspopup="menu" aria-expanded={open && !disabled} aria-controls={open && !disabled ? id : undefined}
      disabled={disabled} onClick={() => open ? close(true) : show()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); show();
        }
      }}><span aria-hidden="true">⋮</span></button>
    {open && !disabled && <div id={id} className="action-menu-items" style={{ ...(alignLeft ? { left: 0, right: "auto" } : {}), ...(above ? { top: "auto", bottom: "calc(100% + .25rem)" } : {}) }} role="menu" aria-label={label} ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Tab") { close(true); return; }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); return; }
        const entries = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
        const index = entries.indexOf(document.activeElement as HTMLElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1
          : event.key === "ArrowDown" ? (index + 1) % entries.length
          : event.key === "ArrowUp" ? (index - 1 + entries.length) % entries.length : null;
        if (next !== null) { event.preventDefault(); entries[next]?.focus(); }
      }}>
      {items.map((item) => {
        const className = item.danger ? "action-menu-danger" : undefined;
        if (item.href && isSafeDisplayUrl(item.href) && !item.disabled) return <a key={item.id} role="menuitem" aria-label={item.label} tabIndex={-1}
          className={className} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => close(true)}>{item.label} ↗</a>;
        return <button key={item.id} type="button" role="menuitem" tabIndex={-1} className={className}
          disabled={item.disabled || Boolean(item.href)} onClick={() => { close(true); item.onSelect?.(); }}>{item.label}</button>;
      })}
    </div>}
  </div>;
}
