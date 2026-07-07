"use client";

interface PrintReportButtonProps {
  label?: string;
  disabled?: boolean;
  documentTitle?: string;
}

export function PrintReportButton({
  label = "طباعة / PDF",
  disabled = false,
  documentTitle,
}: PrintReportButtonProps) {
  const onPrint = () => {
    const previousTitle = document.title;
    if (documentTitle) {
      document.title = documentTitle;
    }
    window.print();
    if (documentTitle) {
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 500);
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPrint}
      className="no-print rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
