// src/modules/financial-management/sales-onboarding/components/KeyboardNavSelect.tsx

import React, { useMemo, useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SearchableSelectProps {
  options: { value: string | number; label: string; sublabel?: string }[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder: string;
  error?: string;
  label: string;
  icon?: React.ReactNode;
}

export default function KeyboardNavSelect({
  options,
  value,
  onChange,
  placeholder,
  error,
  label,
  icon,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(() => {
    return options.find(o => String(o.value) === String(value));
  }, [options, value]);

  // Derived state to synchronize input text with selected value on prop change (e.g. form reset)
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInputValue(selectedOption ? selectedOption.label : "");
  }

  // Filter options based on typed input value
  const filteredOptions = useMemo(() => {
    if (!isOpen) return [];
    const query = inputValue.toLowerCase().trim();
    if (!query) return options;
    return options.filter(
      o =>
        o.label.toLowerCase().includes(query) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query))
    );
  }, [options, inputValue, isOpen]);

  // Limit rendering to 30 items for high performance (fast af & no lag)
  const visibleOptions = useMemo(() => {
    return filteredOptions.slice(0, 30);
  }, [filteredOptions]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Sync input back to selected label if they click away
        setInputValue(selectedOption ? selectedOption.label : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedOption]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        setIsOpen(true);
        setInputValue("");
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        setHighlightedIndex(prev => (prev + 1) % Math.max(1, visibleOptions.length));
        e.preventDefault();
        break;
      case "ArrowUp":
        setHighlightedIndex(prev => (prev - 1 + visibleOptions.length) % Math.max(1, visibleOptions.length));
        e.preventDefault();
        break;
      case "Enter":
        if (visibleOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
          const selected = visibleOptions[highlightedIndex];
          onChange(selected.value);
          setInputValue(selected.label);
          setIsOpen(false);
        }
        e.preventDefault();
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        e.preventDefault();
        break;
      case "Tab":
        // Commit highlighted item on Tab to allow seamless click-free navigation
        if (visibleOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < visibleOptions.length) {
          const selected = visibleOptions[highlightedIndex];
          onChange(selected.value);
          setInputValue(selected.label);
        }
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className="space-y-1.5 relative w-full" ref={containerRef}>
      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1 select-none">
        {icon} {label}
      </label>

      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            setIsOpen(true);
            setInputValue("");
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          className={`w-full h-10 pl-3 pr-10 text-xs rounded-xl bg-background border font-semibold focus:outline-none transition-all ${
            isOpen ? "ring-2 ring-blue-600/20 border-blue-500" : "border-border/60 hover:bg-muted/10"
          } ${error ? "border-red-500" : ""}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
                setInputValue("");
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
          <ChevronDown size={14} className="text-muted-foreground shrink-0" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="max-h-[200px] overflow-y-auto scrollbar-thin divide-y divide-border/20">
            {visibleOptions.length === 0 ? (
              <div className="p-3 text-center italic text-xs text-muted-foreground">
                No matches found
              </div>
            ) : (
              visibleOptions.map((opt, index) => {
                const isSelected = String(opt.value) === String(value);
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setInputValue(opt.label);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 text-xs font-semibold cursor-pointer flex items-center justify-between transition-colors ${
                      isHighlighted ? "bg-accent text-accent-foreground" : isSelected ? "bg-accent/40 text-blue-600" : ""
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="whitespace-normal break-words">{opt.label}</span>
                      {opt.sublabel && <span className="text-[9px] text-muted-foreground font-medium">{opt.sublabel}</span>}
                    </div>
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[10px] font-bold text-red-500">{error}</p>}
    </div>
  );
}