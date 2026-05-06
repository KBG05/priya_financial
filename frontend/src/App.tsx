import { useEffect, useState } from "react";
import { FilterBar } from "@/components/FilterBar";
import { TopBarRight } from "@/components/TopBarRight";
import { ThemeProvider } from "@/hooks/useTheme";
import { Pal1Page } from "@/pages/Pal1Page";
import { MtyPage } from "@/pages/MtyPage";
import { ConsumptionPage } from "@/pages/ConsumptionPage";
import { KpisPage } from "@/pages/KpisPage";
import { DirectExpensesPage } from "@/pages/DirectExpensesPage";
import { ContributionPage } from "@/pages/ContributionPage";
import { api } from "@/api";
import type { ViewMode } from "@/types";
import {
  BarChart3, TrendingUp, Package, Target, Receipt, DollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "pal1" | "mty" | "consumption" | "kpis" | "direct_expenses" | "contribution";

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "pal1",             label: "PAL-1 (P&L)",    icon: BarChart3 },
  { id: "mty",              label: "MTY",             icon: TrendingUp },
  { id: "consumption",      label: "Consumption",     icon: Package },
  { id: "contribution",     label: "Contribution",    icon: DollarSign },
  { id: "direct_expenses",  label: "Direct Expenses", icon: Receipt },
  { id: "kpis",             label: "KPI Scorecard",   icon: Target },
];

function Dashboard() {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [availableFYs, setAvailableFYs] = useState<string[]>([]);
  const [fy, setFy] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("pal1");
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [months, setMonths] = useState<string[]>([]);
  const [prevMonths, setPrevMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load available FYs first, then load months for the default FY
  useEffect(() => {
    api.fyList().then(({ fy_list, default: defaultFy }) => {
      setAvailableFYs(fy_list.length ? fy_list : [defaultFy]);
      setFy(defaultFy);
    });
  }, []);

  useEffect(() => {
    if (!fy) return;
    setLoading(true);
    api.months(fy).then(({ months: m }) => {
      setAvailableMonths(m);
      if (m.length > 0) {
        setMonths([m[m.length - 1]]);
        setPrevMonths(m.length > 1 ? [m[m.length - 2]] : []);
      }
      setLoading(false);
    });
  }, [fy]);

  useEffect(() => {
    if (viewMode === "single" && months.length === 1) {
      const idx = availableMonths.indexOf(months[0]);
      setPrevMonths(idx > 0 ? [availableMonths[idx - 1]] : []);
    }
  }, [months, viewMode, availableMonths]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading MIS data…</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
        {/* Row 1: Logo + nav tabs + right controls */}
        <div className="flex items-center h-13 px-4 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <img src="/Priyafil-Logo-PNG-Final.png" alt="PriyaFil" className="h-7 w-auto object-contain" />
            <div className="hidden sm:flex flex-col justify-center">
              <p className="text-xs font-bold leading-none text-foreground tracking-tight">Priya Textile</p>
              <p className="text-[9px] uppercase tracking-widest font-semibold text-muted-foreground mt-0.5">Financial Dashboard</p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-border/60 shrink-0" />

          {/* Nav tabs */}
          <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 whitespace-nowrap shrink-0",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon size={14} className="shrink-0" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right controls */}
          <TopBarRight availableMonths={availableMonths} fy={fy} availableFYs={availableFYs} />
        </div>
      </header>

      {/* Main content */}
      <main className="p-5 flex flex-col gap-0 overflow-x-hidden min-w-0">
        {/* Filters */}
        <FilterBar
          availableMonths={availableMonths}
          availableFYs={availableFYs}
          fy={fy}
          viewMode={viewMode}
          selectedMonths={months}
          onFyChange={setFy}
          onViewModeChange={setViewMode}
          onMonthsChange={setMonths}
        />

        <div className="my-4 border-t border-border/40" />

        {/* Page content */}
        <div className="flex flex-col gap-4 min-w-0 overflow-x-hidden">
          {activeTab === "pal1"            && <Pal1Page months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
          {activeTab === "mty"             && <MtyPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
          {activeTab === "consumption"     && <ConsumptionPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
          {activeTab === "kpis"            && <KpisPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
          {activeTab === "direct_expenses" && <DirectExpensesPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
          {activeTab === "contribution"    && <ContributionPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
    </ThemeProvider>
  );
}
