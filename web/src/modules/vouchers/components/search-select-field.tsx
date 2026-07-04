"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/modal";

export interface SearchSelectOption {
  id: string;
  label: string;
  sublabel?: string;
  searchText: string;
}

interface SearchSelectFieldProps {
  label: string;
  placeholder?: string;
  options: SearchSelectOption[];
  value: string;
  onChange: (id: string, option: SearchSelectOption | null) => void;
  disabled?: boolean;
  required?: boolean;
  hideLabel?: boolean;
  modalTitle?: string;
  emptyMessage?: string;
  fallbackLabel?: string;
}

export function SearchSelectField({
  label,
  placeholder = "ابحث...",
  options,
  value,
  onChange,
  disabled,
  required,
  hideLabel,
  modalTitle = "اختر من القائمة",
  emptyMessage = "لا توجد نتائج",
  fallbackLabel,
}: SearchSelectFieldProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.id === value) ?? null;

  useEffect(() => {
    if (selected) {
      setQuery(selected.label);
    } else if (value && fallbackLabel) {
      setQuery(fallbackLabel);
    } else if (!value) {
      setQuery("");
    }
  }, [selected, value, fallbackLabel]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filterOptions = (text: string, limit = 12) => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return options.slice(0, limit);
    return options
      .filter((option) => option.searchText.toLowerCase().includes(normalized))
      .slice(0, limit);
  };

  const dropdownOptions = useMemo(
    () => filterOptions(query),
    [query, options],
  );

  const modalOptions = useMemo(
    () => filterOptions(modalQuery, 100),
    [modalQuery, options],
  );

  const pickOption = (option: SearchSelectOption) => {
    onChange(option.id, option);
    setQuery(option.label);
    setIsOpen(false);
    setIsModalOpen(false);
  };

  const clearSelection = () => {
    onChange("", null);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <>
      <div ref={containerRef} className="relative grid gap-1 text-sm">
        {!hideLabel && (
          <span className="font-medium text-slate-700">
            {label}
            {required && <span className="text-rose-600"> *</span>}
          </span>
        )}
        <div className="flex gap-1">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
              if (!event.target.value.trim()) {
                onChange("", null);
              }
            }}
            onFocus={() => setIsOpen(true)}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-blue-900 disabled:bg-slate-50"
          />
          <button
            type="button"
            onClick={() => {
              setModalQuery(query);
              setIsModalOpen(true);
            }}
            disabled={disabled}
            className="shrink-0 rounded-md border border-slate-300 px-2.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            title="فتح قائمة البحث"
          >
            ⋯
          </button>
        </div>

        {isOpen && !disabled && (
          <ul className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-300 bg-white shadow-lg">
            {dropdownOptions.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</li>
            )}
            {dropdownOptions.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  onClick={() => pickOption(option)}
                  className="block w-full px-3 py-2 text-right hover:bg-blue-50"
                >
                  <p className="text-sm font-medium text-slate-900">{option.label}</p>
                  {option.sublabel && (
                    <p className="text-xs text-slate-500">{option.sublabel}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected && !disabled && (
          <button
            type="button"
            onClick={clearSelection}
            className="justify-self-start text-xs text-slate-500 hover:text-rose-700"
          >
            مسح الاختيار
          </button>
        )}
      </div>

      <Modal
        open={isModalOpen}
        size="lg"
        title={modalTitle}
        onClose={() => setIsModalOpen(false)}
      >
        <input
          value={modalQuery}
          onChange={(event) => setModalQuery(event.target.value)}
          placeholder={placeholder}
          className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoFocus
        />
        <ul className="max-h-[min(60vh,420px)] overflow-auto rounded-md border border-slate-200">
          {modalOptions.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              {emptyMessage}
            </li>
          )}
          {modalOptions.map((option) => (
            <li key={option.id} className="border-b border-slate-100 last:border-0">
              <button
                type="button"
                onClick={() => pickOption(option)}
                className="block w-full px-4 py-3 text-right hover:bg-blue-50"
              >
                <p className="font-medium text-slate-900">{option.label}</p>
                {option.sublabel && (
                  <p className="mt-0.5 text-xs text-slate-500">{option.sublabel}</p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
