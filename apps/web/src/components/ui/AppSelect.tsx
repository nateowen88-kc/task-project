import { useEffect, useRef, useState } from "react";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type AppSelectProps<T extends string> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

export function AppSelect<T extends string>({
  value,
  options,
  onChange,
  className,
  menuClassName,
  ariaLabel,
  disabled,
}: AppSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      ref={rootRef}
      className={`${className ?? "app-select"} ${isOpen ? "is-open" : ""}`}
      style={{ position: "relative", width: "100%" }}
    >
      <button
        type="button"
        className="app-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
      >
        <span>{selectedOption?.label}</span>
        <span aria-hidden="true" className="app-select-chevron">
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          className={menuClassName ?? "app-select-menu"}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`app-select-option ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {isSelected && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
