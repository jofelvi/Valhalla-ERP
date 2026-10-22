import { useState, ReactNode } from 'react';

interface ExpandableAuditSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function ExpandableAuditSection({
  title,
  count,
  defaultOpen = false,
  children,
}: ExpandableAuditSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-elevated/50 border-b border-line hover:bg-elevated/70 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-content">{title}</h3>
          <span className="text-xs font-medium text-dim bg-elevated px-2 py-1 rounded">
            {count}
          </span>
        </div>
        <span
          className={`text-dim transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          ▼
        </span>
      </button>
      {isOpen && children}
    </div>
  );
}
