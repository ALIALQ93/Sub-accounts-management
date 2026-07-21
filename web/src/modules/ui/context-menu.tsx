"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { ContextMenuItem } from "@/modules/materials/utils/section-context-menus";

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: ReactNode;
  className?: string;
  onAction?: (action: string, item: ContextMenuItem) => void;
}

export function ContextMenu({
  items,
  children,
  className,
  onAction,
}: ContextMenuProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  const handleContextMenu = (event: ReactMouseEvent) => {
    if (items.length === 0) return;
    event.preventDefault();
    setPosition({ x: event.clientX, y: event.clientY });
    setOpen(true);
  };

  const handleItemClick = (item: ContextMenuItem) => {
    setOpen(false);
    if (item.href) {
      router.push(item.href);
      return;
    }
    if (item.action) {
      onAction?.(item.action, item);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={className}
      onContextMenu={handleContextMenu}
    >
      {children}
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[80] min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          style={{ left: position.x, top: position.y }}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-right text-sm text-slate-800 hover:bg-slate-100"
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
