import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useCurrency } from '../../../app/providers/CurrencyProvider';
import { CreatePortfolioModal } from '../components/CreatePortfolioModal';
import { RenamePortfolioModal } from '../components/RenamePortfolioModal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { HomeNavbarControls } from '../components/home/HomeNavbarControls';
import { HomePortfoliosTable } from '../components/home/HomePortfoliosTable';
import { useHomeDashboardState } from '../hooks/useHomeDashboardState';
import { lazyNamed } from '../../../utils/lazyNamed';

const PerformanceChart = lazyNamed(
  () => import('../components/PerformanceChart'),
  'PerformanceChart'
);

export function HomeDashboard() {
  const { formatCurrency: fmtCurrency } = useCurrency();
  const state = useHomeDashboardState();

  if (state.isLoading) {
    return (
      <div className="h-full flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-tertiary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <HomeNavbarControls
        navbarLeftPortalElement={state.navbarLeftPortalElement}
        navbarPortalElement={state.navbarPortalElement}
        portfolios={state.portfolios}
        selectedSummaryPortfolioIds={state.selectedSummaryPortfolioIds}
        setSelectedSummaryPortfolioIds={state.setSelectedSummaryPortfolioIds}
        toggleSummaryPortfolioSelection={state.toggleSummaryPortfolioSelection}
        isSummaryDropdownOpen={state.isSummaryDropdownOpen}
        setIsSummaryDropdownOpen={state.setIsSummaryDropdownOpen}
        summaryDropdownRef={state.summaryDropdownRef}
        sortField={state.sortField}
        clearSort={() => state.setSortField(null)}
        openCreateModal={() => state.setIsCreateModalOpen(true)}
        isSettingsOpen={state.isSettingsOpen}
        setIsSettingsOpen={state.setIsSettingsOpen}
        settingsRef={state.settingsRef}
        sensors={state.sensors}
        summaryOrder={state.summaryOrder}
        visibleStats={state.visibleStats}
        onStatDragEnd={state.handleStatDragEnd}
        onToggleStat={state.toggleStat}
      />

      {state.isChartVisible && (
        <Suspense fallback={null}>
          <PerformanceChart
            selectedPortfolioId={
              state.selectedSummaryPortfolioIds?.length
                ? state.selectedSummaryPortfolioIds.join(',')
                : 'NONE'
            }
          />
        </Suspense>
      )}

      <HomePortfoliosTable
        portfolios={state.portfolios}
        stocks={state.stocks}
        stats={state.stats}
        portfolioSummaries={state.portfolioSummaries}
        totalUniqueStocks={state.totalUniqueStocks}
        totalBrokerageAndTax={state.totalBrokerageAndTax}
        summaryOrder={state.summaryOrder}
        visibleStats={state.visibleStats}
        sortedPortfolioOrder={state.sortedPortfolioOrder}
        selectedSummaryPortfolioIds={state.selectedSummaryPortfolioIds}
        setSelectedSummaryPortfolioIds={state.setSelectedSummaryPortfolioIds}
        isChartVisible={state.isChartVisible}
        setIsChartVisible={state.setIsChartVisible}
        sortField={state.sortField}
        sortDirection={state.sortDirection}
        onSort={state.handleSort}
        sensors={state.sensors}
        onPortfolioDragEnd={state.handlePortfolioDragEnd}
        fmtCurrency={fmtCurrency}
        activeMenuId={state.activeMenuId}
        setActiveMenuId={state.setActiveMenuId}
        menuPosition={state.menuPosition}
        setMenuPosition={state.setMenuPosition}
        onRenamePortfolio={state.setRenamePortfolioId}
        onCopyPortfolio={state.handleCopyPortfolio}
        onDeletePortfolio={state.handleDeletePortfolio}
        setConfirmationConfig={state.setConfirmationConfig}
        openCreateModal={() => state.setIsCreateModalOpen(true)}
      />

      <CreatePortfolioModal
        isOpen={state.isCreateModalOpen}
        onClose={() => state.setIsCreateModalOpen(false)}
        onCreated={() => state.fetchData()}
      />

      <RenamePortfolioModal
        isOpen={!!state.renamePortfolioId}
        onClose={() => state.setRenamePortfolioId(null)}
        onRenamed={() => state.fetchData()}
        portfolioId={state.renamePortfolioId}
        currentName={
          state.portfolios.find(p => p.id === state.renamePortfolioId)?.name || ''
        }
      />

      {state.confirmationConfig && (
        <ConfirmationModal
          isOpen={state.confirmationConfig.isOpen}
          onClose={() => state.setConfirmationConfig(null)}
          onConfirm={state.confirmationConfig.onConfirm}
          title={state.confirmationConfig.title}
          message={state.confirmationConfig.message}
          confirmText={state.confirmationConfig.confirmText}
          isDestructive={state.confirmationConfig.isDestructive}
          requireInputToConfirm={state.confirmationConfig.requireInputToConfirm}
        />
      )}
    </div>
  );
}
