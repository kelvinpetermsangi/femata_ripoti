import { useEffect, useMemo, useRef, useState } from "react";

export type AnimatedSelectOption = {
  value: string;
  label: string;
  note?: string;
};

type AnimatedSelectProps = {
  value: string;
  options: AnimatedSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  align?: "left" | "right";
  lightMode?: boolean;
};

const AnimatedSelect = ({
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  align = "left",
  lightMode = false,
}: AnimatedSelectProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const listNeedsScroll = options.length > 8;

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <style>{`.admin-select-scroll::-webkit-scrollbar{display:none;}`}</style>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`group flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm outline-none transition duration-200 ${
          disabled
            ? lightMode
              ? "cursor-not-allowed border-rose-200 bg-rose-50 text-slate-500 opacity-90"
              : "cursor-not-allowed border-white/10 bg-white/5 text-white opacity-60"
            : open
              ? lightMode
                ? "border-sky-300 bg-white text-slate-900 shadow-[0_16px_36px_rgba(59,130,246,0.12)]"
                : "border-cyan-300/30 bg-slate-900/90 text-white shadow-[0_16px_36px_rgba(8,47,73,0.28)]"
              : lightMode
                ? "border-slate-200 bg-white text-slate-900 hover:border-sky-300 hover:bg-slate-50"
                : "border-white/10 bg-slate-950/50 text-white hover:border-cyan-300/20 hover:bg-slate-900/80"
        }`}
      >
        <div className="min-w-0">
          <p className={`truncate font-medium ${selected ? (lightMode ? "text-slate-900" : "text-white") : lightMode ? "text-slate-500" : "text-slate-400"}`}>{selected?.label || placeholder}</p>
          {selected?.note ? <p className={`mt-1 truncate text-xs ${lightMode ? "text-slate-500" : "text-slate-400"}`}>{selected.note}</p> : null}
        </div>
        {disabled ? (
          <svg
            viewBox="0 0 20 20"
            className="ml-3 h-5 w-5 shrink-0 text-rose-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="10" cy="10" r="6.5" />
            <path d="M6.5 13.5l7-7" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 20 20"
            className={`ml-3 h-4 w-4 shrink-0 transition duration-200 ${lightMode ? "text-sky-600" : "text-cyan-200"} ${open ? "rotate-180" : "rotate-0"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 7.5l5 5 5-5" />
          </svg>
        )}
      </button>

      <div
        className={`absolute z-30 mt-2 w-full transition duration-200 ${align === "right" ? "right-0" : "left-0"} ${open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}
      >
        <div className={`overflow-hidden rounded-[26px] p-2 shadow-[0_24px_60px_rgba(2,6,23,0.45)] backdrop-blur-xl ${lightMode ? "border border-slate-200 bg-white" : "border border-cyan-300/15 bg-[linear-gradient(180deg,rgba(8,15,31,0.98),rgba(15,23,42,0.98))]"}`}>
          <div
            className={`admin-select-scroll space-y-1 ${listNeedsScroll ? "max-h-72 overflow-y-auto pr-1" : "overflow-hidden"}`}
            style={listNeedsScroll ? { scrollbarWidth: "none", msOverflowStyle: "none" } : undefined}
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full rounded-2xl px-4 py-3 text-left transition ${active ? (lightMode ? "bg-sky-50 text-slate-900" : "bg-gradient-to-r from-cyan-400/20 via-sky-400/15 to-emerald-300/10 text-white") : lightMode ? "bg-transparent text-slate-700 hover:bg-slate-50" : "bg-transparent text-slate-200 hover:bg-white/5"}`}
                >
                  <p className="text-sm font-semibold">{option.label}</p>
                  {option.note ? <p className={`mt-1 text-xs ${lightMode ? "text-slate-500" : "text-slate-400"}`}>{option.note}</p> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedSelect;
