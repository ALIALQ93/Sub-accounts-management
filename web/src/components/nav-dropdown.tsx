"use client";

import { useEffect, useRef, useState } from "react";
import type { NavChildLink } from "@/config/app-navigation";
import { NavTabLink } from "@/components/nav-tab-link";

interface NavDropdownProps {
  label: string;
  items: NavChildLink[];
  isActive: boolean;
  canAccess: (permission?: NavChildLink["permission"]) => boolean;
}

export function NavDropdown({
  label,
  items,
  isActive,
  canAccess,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleItems = items.filter(
    (item) => !item.permission || canAccess(item.permission),
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (visibleItems.length === 0) return null;

  const triggerClass = isActive
    ? "bg-[var(--brand-gold)] text-[var(--brand-navy)] shadow-sm"
    : "text-white/90 hover:bg-white/10 hover:text-white";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${triggerClass}`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-80" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--brand-border)] bg-white py-1 shadow-lg"
        >
          {visibleItems.map((item) => (
            <NavTabLink
              key={item.href}
              href={item.href}
              onNavigate={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
            >
              {item.label}
            </NavTabLink>
          ))}
        </div>
      )}
    </div>
  );
}
