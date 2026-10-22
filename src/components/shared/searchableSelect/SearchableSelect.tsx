'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { FieldError } from 'react-hook-form';
import { useBusqueda } from '@/shared/hooks/useBusqueda';
import FormFieldError from '@/components/shared/formFieldError/FormFieldError';
import { AlertCircle, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/utils/utils';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id: string;
  label?: string;
  options: SearchableSelectOption[];
  value?: string | number;
  onChange: (value: string) => void;
  error?: FieldError | string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  labelClassName?: string;
}

export default function SearchableSelect({
  id,
  label,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  className = '',
  labelClassName,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const hasError = Boolean(error);

  const sortedOptions = useMemo(
    () =>
      [...options].sort((a, b) =>
        a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }),
      ),
    [options],
  );

  const filteredOptions = useBusqueda(sortedOptions, search, ['label']);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)),
    [options, value],
  );

  const updateDropdownPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition();
      window.addEventListener('scroll', updateDropdownPosition, true);
      window.addEventListener('resize', updateDropdownPosition);
      return () => {
        window.removeEventListener('scroll', updateDropdownPosition, true);
        window.removeEventListener('resize', updateDropdownPosition);
      };
    }
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search]);

  const handleSelect = (optionValue: string | number) => {
    onChange(String(optionValue));
    setIsOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev < filteredOptions.length - 1 ? prev + 1 : prev;
          scrollToIndex(next);
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : 0;
          scrollToIndex(next);
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredOptions.length
        ) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) {
            handleSelect(opt.value);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        break;
    }
  };

  const scrollToIndex = (index: number) => {
    if (listRef.current) {
      const items = listRef.current.children;
      if (items[index]) {
        items[index].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const labelClasses = cn(
    'block text-sm font-semibold mb-2',
    hasError ? 'text-danger' : 'text-dim',
    disabled && 'text-dim',
    labelClassName,
  );

  const triggerClasses = cn(
    'h-11 w-full rounded-xl border bg-surface/90 backdrop-blur-sm px-3 py-2 text-sm shadow-sm',
    'transition-all duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-offset-0',
    'cursor-pointer',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-elevated',
    hasError
      ? 'border-danger focus:border-danger focus:ring-danger/30'
      : disabled
        ? 'border-line bg-elevated text-dim'
        : 'border-line focus:border-brand focus:ring-brand/30 focus:bg-surface',
  );

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
        >
          <div className="bg-surface border border-line rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-line">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-line bg-elevated focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand placeholder:text-dim"
                />
              </div>
            </div>

            <ul
              ref={listRef}
              role="listbox"
              className="max-h-80 overflow-y-auto py-1"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-6 text-sm text-dim text-center">
                  No se encontraron resultados
                </li>
              ) : (
                filteredOptions.map((opt, index) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <li
                      key={opt.value}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled}
                      onClick={() => {
                        if (!opt.disabled) handleSelect(opt.value);
                      }}
                      className={cn(
                        'px-3 py-2 text-sm cursor-pointer transition-colors duration-100',
                        opt.disabled && 'opacity-50 cursor-not-allowed',
                        isSelected &&
                          !isHighlighted &&
                          'bg-elevated text-dim font-medium',
                        isHighlighted && 'bg-elevated text-content',
                        !isSelected &&
                          !isHighlighted &&
                          !opt.disabled &&
                          'hover:bg-elevated',
                      )}
                    >
                      {opt.label}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={cn('space-y-1', className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className={labelClasses}>
          {label}
          {required && (
            <span className="text-danger ml-1" aria-label="Campo requerido">
              *
            </span>
          )}
        </label>
      )}

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            triggerClasses,
            'flex items-center justify-between pr-10',
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${id}-error` : undefined}
        >
          <span
            className={cn(
              'truncate',
              selectedOption ? 'text-content' : 'text-dim',
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </button>

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-elevated transition-colors"
              tabIndex={-1}
            >
              <X className="w-3.5 h-3.5 text-dim hover:text-dim" />
            </button>
          )}
          {hasError ? (
            <AlertCircle className="w-4 h-4 text-danger pointer-events-none" />
          ) : (
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-all duration-200 pointer-events-none',
                disabled ? 'text-dim' : 'text-brand',
                isOpen && 'rotate-180',
              )}
            />
          )}
        </div>

        {dropdown}
      </div>

      {hasError && (
        <div id={`${id}-error`}>
          <FormFieldError error={error} />
        </div>
      )}
    </div>
  );
}
