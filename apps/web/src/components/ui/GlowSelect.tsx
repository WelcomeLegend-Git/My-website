import { clsx } from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";

export type GlowSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

type GlowSelectProps = {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  options: GlowSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  listClassName?: string;
  align?: "left" | "right";
};

export const GlowSelect = ({
  id,
  value,
  onChange,
  onBlur,
  options,
  placeholder = "Select option",
  disabled = false,
  className,
  buttonClassName,
  listClassName,
  align = "left",
}: GlowSelectProps) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const normalizedValue = value ?? "";

  const selectedOption = useMemo(
    () => options.find((option) => option.value === normalizedValue),
    [normalizedValue, options],
  );

  useEffect(() => {
    if (!open) {
      setHighlighted(-1);
      return;
    }

    if (selectedOption) {
      const selectedIndex = options.findIndex((option) => option.value === selectedOption.value);
      setHighlighted(selectedIndex);
    } else {
      const firstEnabled = options.findIndex((option) => !option.disabled);
      setHighlighted(firstEnabled);
    }
  }, [open, options, selectedOption]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      window.addEventListener("mousedown", handleClick);
    }

    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleSelect = (option: GlowSelectOption) => {
    if (option.disabled) {
      return;
    }
    onChange?.(option.value);
    setOpen(false);
    onBlur?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((previous) => !previous);
    }

    if (!open) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => {
        const direction = event.key === "ArrowDown" ? 1 : -1;
        let next = current;

        for (let i = 0; i < options.length; i += 1) {
          next = (next + direction + options.length) % options.length;
          if (!options[next].disabled) {
            return next;
          }
        }
        return current;
      });
    }

    if (event.key === "Enter" && highlighted >= 0) {
      event.preventDefault();
      const option = options[highlighted];
      if (option && !option.disabled) {
        handleSelect(option);
      }
    }
  };

  useEffect(() => {
    if (!open || highlighted < 0) {
      return;
    }
    const listEl = containerRef.current?.querySelector<HTMLUListElement>("[role='listbox']");
    const optionEl = listEl?.children[highlighted] as HTMLElement | undefined;
    optionEl?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  return (
    <div ref={containerRef} className={clsx("relative", className)}>
      <button
        id={id}
        type="button"
        className={clsx(
          "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-100 backdrop-blur transition-all duration-300",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/50 hover:shadow-[0_8px_24px_-12px_rgba(99,102,241,0.45)]",
          buttonClassName,
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setOpen((previous) => !previous);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        disabled={disabled}
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-slate-200">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="text-xs text-slate-500">{selectedOption.description}</span>
          ) : null}
        </span>
        <svg
          className={clsx(
            "h-4 w-4 text-slate-400 transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          )}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M5 7l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        className={clsx(
          "absolute z-40 mt-2 w-full min-w-[12rem] origin-top overflow-hidden rounded-2xl border border-slate-800/60 bg-slate-950/95/ backdrop-blur-xl shadow-[0_28px_60px_-30px_rgba(56,189,248,0.45)] transition-all duration-200",
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0",
          align === "right" ? "right-0" : "left-0",
          listClassName,
        )}
        role="presentation"
      >
        <ul
          role="listbox"
          aria-activedescendant={highlighted >= 0 ? `${id}-option-${highlighted}` : undefined}
          className="max-h-60 overflow-y-auto py-2 text-sm text-slate-200 custom-scrollbar"
        >
          {options.map((option, index) => {
            const isSelected = option.value === normalizedValue;
            const isHighlighted = highlighted === index;

            return (
              <li
                key={option.value}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                tabIndex={-1}
                className={clsx(
                  "mx-1 flex cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2",
                  option.disabled
                    ? "cursor-not-allowed text-slate-500"
                    : "hover:bg-primary/10 hover:text-primary",
                  isHighlighted ? "bg-primary/10 text-primary" : null,
                  isSelected ? "border border-primary/40 bg-primary/15" : "border border-transparent",
                )}
                onMouseEnter={() => {
                  if (!option.disabled) {
                    setHighlighted(index);
                  }
                }}
                onClick={() => handleSelect(option)}
              >
                <span className="flex flex-col">
                  <span className="font-medium">{option.label}</span>
                  {option.description ? (
                    <span className="text-xs text-slate-500">{option.description}</span>
                  ) : null}
                </span>
                {isSelected ? (
                  <svg
                    className="h-4 w-4 text-primary"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M5 10l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
