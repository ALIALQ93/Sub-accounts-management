"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NavChildLink } from "@/config/app-navigation";
import { NavTabLink } from "@/components/nav-tab-link";

interface NavDropdownProps {
  label: string;
  items: NavChildLink[];
  isActive: boolean;
  canAccess: (permission?: NavChildLink["permission"]) => boolean;
}

interface MenuPosition {
  top: number;
  right: number;
  minWidth: number;
}

export function NavDropdown({
  label,
  items,
  isActive,
  canAccess,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const visibleItems = items.filter(
    (item) => !item.permission || canAccess(item.permission),
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 200),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReposition = () => updatePosition();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition]);

  if (visibleItems.length === 0) return null;

  const triggerClass = isActive
    ? "bg-[var(--brand-gold)] text-[var(--brand-navy)] shadow-sm"
    : "text-white/90 hover:bg-white/10 hover:text-white";

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium transition ${triggerClass}`}
      >
        <span>{label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`opacity-80 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        mounted &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: position.top,
              right: position.right,
              minWidth: position.minWidth,
              maxHeight: "calc(100vh - 6rem)",
            }}
            className="z-[100] animate-[fade-in-up_0.16s_ease-out] overflow-y-auto rounded-lg border border-[var(--brand-border)] bg-white py-1 shadow-lg"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
