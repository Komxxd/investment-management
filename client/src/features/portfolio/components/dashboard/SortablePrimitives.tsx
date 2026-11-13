import React from 'react';
import { GripVertical, Check, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DashboardOption } from './dashboardConfig';

export function SortableChecklistItem({
  item,
  isVisible,
  onToggle,
}: {
  item: DashboardOption;
  isVisible: boolean;
  onToggle: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-full flex items-center px-2 py-1 text-[9px] text-left hover:bg-background text-primary transition-colors ${isDragging ? 'bg-surface shadow-md border border-divider rounded-md' : ''}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="w-4 flex justify-center mr-1 shrink-0 cursor-grab active:cursor-grabbing text-secondary/50 hover:text-secondary"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="w-4 flex justify-center mr-1 shrink-0 cursor-pointer" onClick={() => onToggle(item.id)}>
        {isVisible && <Check className="w-3 h-3 text-primary" />}
      </div>
      <span className="flex-1 cursor-pointer select-none" onClick={() => onToggle(item.id)}>
        {item.label}
      </span>
    </div>
  );
}

export function SortableStatCard({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

export function SortableHeaderCell({
  field,
  label,
  width,
  isNumber,
  sortField,
  sortDirection,
  resizingColId,
  onSort,
  onResizeStart,
  className,
}: {
  field: string;
  label: string;
  width: number;
  isNumber: boolean;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  resizingColId: string | undefined;
  onSort: (field: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, w: number) => void;
  className?: string;
}) {
  const {
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };

  if (isDragging) {
    style.zIndex = 100;
  }

  return (
    <th
      ref={setNodeRef}
      style={{ ...style, width, minWidth: width, maxWidth: width }}
      {...listeners}
      className={`px-1.5 py-1.5 sm:px-3 sm:py-2 text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-secondary cursor-pointer hover:bg-surface-hover transition-colors select-none group relative ${resizingColId === field ? 'bg-surface-hover' : ''} ${isDragging ? 'shadow-md border border-divider cursor-grabbing' : 'bg-surface'} ${isNumber ? 'text-center' : 'text-left'} ${className || ''}`}
      onClick={() => {
        if (isDragging) return;
        onSort(field);
      }}
    >
      {field === 'strategy' ? (
        <div className="flex flex-col w-full select-none -my-0.5">
          <div className="flex items-center justify-center gap-1 pb-0.5 border-b border-divider/60">
            <span className="font-semibold text-primary truncate">Strategy</span>
            {sortField === field ? (
              sortDirection === 'asc' ? <ChevronUp className="w-2.5 h-2.5 text-primary shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 text-primary shrink-0" />
            ) : (
              <ArrowUpDown className="w-2.5 h-2.5 text-tertiary group-hover:text-secondary transition-colors shrink-0" />
            )}
          </div>
          <div className="grid grid-cols-3 text-[8px] sm:text-[9px] text-tertiary divide-x divide-divider/60 pt-0.5 font-medium normal-case tracking-normal text-center">
            <span className="truncate px-0.5">Status</span>
            <span className="truncate px-0.5">Signal</span>
            <span className="truncate px-0.5">Logs</span>
          </div>
        </div>
      ) : (
        <div className={`flex items-center gap-1 overflow-hidden ${isNumber ? 'justify-center' : 'justify-start'}`}>
          <span className="truncate">{label}</span>
          {sortField === field ? (
            sortDirection === 'asc' ? <ChevronUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" /> : <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary shrink-0" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-tertiary group-hover:text-secondary transition-colors shrink-0" />
          )}
        </div>
      )}

      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 hidden group-hover:block z-50 whitespace-nowrap bg-surface text-primary text-[8px] sm:text-[10px] font-medium px-2 py-1 rounded border border-divider pointer-events-none normal-case tracking-normal">
        {label}
      </div>

      <div
        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, field, width);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}

