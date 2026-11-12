import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, Check, Columns, FilterX } from 'lucide-react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableChecklistItem } from '../dashboard/SortablePrimitives';
import { SUMMARY_STATS } from './homeDashboardConfig';
import type { Portfolio } from '../../hooks/usePortfolioData';

interface HomeNavbarControlsProps {
  navbarLeftPortalElement: HTMLElement | null;
  navbarPortalElement: HTMLElement | null;
  portfolios: Portfolio[];
  selectedSummaryPortfolioIds: string[] | null;
  setSelectedSummaryPortfolioIds: (ids: string[]) => void;
  toggleSummaryPortfolioSelection: (id: string) => void;
  isSummaryDropdownOpen: boolean;
  setIsSummaryDropdownOpen: (open: boolean) => void;
  summaryDropdownRef: RefObject<HTMLDivElement | null>;
  sortField: string | null;
  clearSort: () => void;
  openCreateModal: () => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  settingsRef: RefObject<HTMLDivElement | null>;
  sensors: SensorDescriptor<SensorOptions>[];
  summaryOrder: string[];
  visibleStats: Set<string>;
  onStatDragEnd: (event: DragEndEvent) => void;
  onToggleStat: (id: string) => void;
}

/**
 * Portals the HomeDashboard portfolio filter dropdown and action buttons into the top navbar.
 */
export function HomeNavbarControls({
  navbarLeftPortalElement,
  navbarPortalElement,
  portfolios,
  selectedSummaryPortfolioIds,
  setSelectedSummaryPortfolioIds,
  toggleSummaryPortfolioSelection,
  isSummaryDropdownOpen,
  setIsSummaryDropdownOpen,
  summaryDropdownRef,
  sortField,
  clearSort,
  openCreateModal,
  isSettingsOpen,
  setIsSettingsOpen,
  settingsRef,
  sensors,
  summaryOrder,
  visibleStats,
  onStatDragEnd,
  onToggleStat,
}: HomeNavbarControlsProps) {
  return (
    <>
      {navbarLeftPortalElement &&
        createPortal(
          <div className="relative z-40" ref={summaryDropdownRef}>
            <button
              onClick={() => setIsSummaryDropdownOpen(!isSummaryDropdownOpen)}
              className="flex items-center justify-between gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold text-primary hover:opacity-80 transition-opacity bg-surface py-1 sm:py-1.5 px-1.5 sm:px-3 rounded border border-divider min-w-[110px] sm:w-[140px]"
            >
              <span className="truncate text-left">
                {selectedSummaryPortfolioIds === null ||
                selectedSummaryPortfolioIds.length === portfolios.length
                  ? 'All Portfolios'
                  : selectedSummaryPortfolioIds.length === 1
                    ? portfolios.find(p => p.id === selectedSummaryPortfolioIds[0])?.name || 'Selected'
                    : selectedSummaryPortfolioIds.length === 0
                      ? 'None Selected'
                      : `${selectedSummaryPortfolioIds.length} Portfolios Selected`}
              </span>
              <ChevronDown
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 text-secondary transition-transform ${
                  isSummaryDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isSummaryDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-surface border border-divider rounded-lg shadow-xl shadow-black/20 py-1 max-h-64 overflow-y-auto z-50">
                <button
                  onClick={() => {
                    const allSelected = selectedSummaryPortfolioIds?.length === portfolios.length;
                    setSelectedSummaryPortfolioIds(
                      allSelected ? [] : portfolios.map(p => p.id)
                    );
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center gap-2 border-b border-divider text-primary hover:bg-surface-hover font-medium mb-1"
                >
                  <div
                    className={`w-3.5 h-3.5 shrink-0 rounded-sm border ${
                      selectedSummaryPortfolioIds?.length === portfolios.length
                        ? 'bg-primary border-primary flex items-center justify-center'
                        : 'border-secondary'
                    }`}
                  >
                    {selectedSummaryPortfolioIds?.length === portfolios.length && (
                      <Check className="w-2.5 h-2.5 text-background" />
                    )}
                  </div>
                  <span>
                    {selectedSummaryPortfolioIds?.length === portfolios.length
                      ? 'Unselect All'
                      : 'Select All'}
                  </span>
                </button>
                {portfolios.map(p => {
                  const isSelected = selectedSummaryPortfolioIds?.includes(p.id) || false;
                  return (
                    <button
                      key={p.id}
                      onClick={() => toggleSummaryPortfolioSelection(p.id)}
                      className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 truncate ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-secondary hover:bg-surface-hover hover:text-primary'
                      }`}
                      title={p.name}
                    >
                      <div
                        className={`w-3.5 h-3.5 shrink-0 rounded-sm border ${
                          isSelected
                            ? 'bg-primary border-primary flex items-center justify-center'
                            : 'border-secondary'
                        }`}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-background" />}
                      </div>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>,
          navbarLeftPortalElement
        )}

      {navbarPortalElement &&
        createPortal(
          <>
            {sortField !== null && (
              <button
                onClick={clearSort}
                className="flex items-center justify-center gap-1 sm:gap-1.5 p-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium text-secondary hover:text-primary hover:bg-surface-hover transition-colors rounded border border-divider"
                title="Clear sorting"
              >
                <FilterX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              onClick={openCreateModal}
              className="flex items-center justify-center gap-1 sm:gap-1.5 p-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-xs font-medium bg-primary text-background hover:opacity-90 transition-opacity rounded"
              title="Create New Portfolio"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Create New Portfolio</span>
            </button>

            <div className="relative flex" ref={settingsRef}>
              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-surface hover:bg-surface-hover border border-divider rounded text-secondary hover:text-primary transition-colors"
                title="Customize Summary"
              >
                <Columns className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>

              {isSettingsOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-surface border border-divider rounded-lg shadow-xl shadow-black/20 py-1 max-h-80 overflow-y-auto z-50">
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onStatDragEnd}
                  >
                    <SortableContext items={summaryOrder} strategy={verticalListSortingStrategy}>
                      {summaryOrder.map(id => {
                        const stat = SUMMARY_STATS.find(s => s.id === id);
                        if (!stat) return null;
                        return (
                          <SortableChecklistItem
                            key={id}
                            item={stat}
                            isVisible={visibleStats.has(id)}
                            onToggle={onToggleStat}
                          />
                        );
                      })}
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          </>,
          navbarPortalElement
        )}
    </>
  );
}

