import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, type TabId } from "@/components/AppSidebar";
import { FilterBar } from "@/components/FilterBar";
import { TopBarRight } from "@/components/TopBarRight";
import { ThemeProvider } from "@/hooks/useTheme";
import { Pal1Page } from "@/pages/Pal1Page";
import { MtyPage } from "@/pages/MtyPage";
import { ConsumptionPage } from "@/pages/ConsumptionPage";
import { KpisPage } from "@/pages/KpisPage";
import { DirectExpensesPage } from "@/pages/DirectExpensesPage";
import { api } from "@/api";
import type { ViewMode } from "@/types";

const PAGE_TITLES: Record<TabId, string> = {
  pal1: "PAL-1 (P&L)",
  mty: "MTY",
  consumption: "Consumption",
  kpis: "KPI Scorecard",
  direct_expenses: "Direct Expenses",
};

function Dashboard() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("pal1");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [months, setMonths] = useState<string[]>([]);
  const [prevMonths, setPrevMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.months().then(({ months: m }) => {
      setAvailableMonths(m);
      if (m.length > 0) {
        setMonths([m[m.length - 1]]);
        setPrevMonths(m.length > 1 ? [m[m.length - 2]] : []);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (viewMode === "single" && months.length === 1) {
      const idx = availableMonths.indexOf(months[0]);
      setPrevMonths(idx > 0 ? [availableMonths[idx - 1]] : []);
    }
  }, [months, viewMode, availableMonths]);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab !== "mty" && viewMode === "mty-all") {
      setViewMode("single");
      setMonths([availableMonths[availableMonths.length - 1]]);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading MIS data…</p>
      </div>
    </div>
  );

  return (
    <SidebarProvider>
      <AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <SidebarInset>
        {/* Sticky top bar — title, sidebar trigger, theme + user avatar only */}
        <header className="flex h-13 items-center gap-2.5 border-b border-border px-4 sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
          <SidebarTrigger className="-ml-1 h-8 w-8" />
          <Separator orientation="vertical" className="h-4 mx-0.5" />
          <h1 className="text-sm font-semibold text-foreground">{PAGE_TITLES[activeTab]}</h1>
          <div className="ml-auto">
            <TopBarRight />
          </div>
        </header>

        {/* Main content: filter zone + page zone with clear separation */}
        <main className="p-5 flex flex-col gap-0">
          {/* Group 1: Filters */}
          <FilterBar
            availableMonths={availableMonths}
            viewMode={viewMode}
            selectedMonths={months}
            isMtyTab={activeTab === "mty"}
            onViewModeChange={setViewMode}
            onMonthsChange={setMonths}
          />

          {/* Divider between filter zone and data zone */}
          <div className="my-4 border-t border-border/40" />

          {/* Group 2: Page content (hero cards + breakdowns) */}
          <div className="flex flex-col gap-4">
            {activeTab === "pal1" && <Pal1Page months={months} viewMode={viewMode} prevMonths={prevMonths} />}
            {activeTab === "mty" && <MtyPage months={months} viewMode={viewMode} prevMonths={prevMonths} />}
            {activeTab === "consumption" && <ConsumptionPage months={months} viewMode={viewMode} prevMonths={prevMonths} />}
            {activeTab === "kpis" && <KpisPage months={months} viewMode={viewMode} prevMonths={prevMonths} />}
            {activeTab === "direct_expenses" && <DirectExpensesPage months={months} viewMode={viewMode} prevMonths={prevMonths} />}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
