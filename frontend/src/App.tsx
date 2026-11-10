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
import { QuoteBuilderPage } from "@/pages/QuoteBuilderPage";
import { api } from "@/api";
import { periodLabel } from "@/lib/periodLabel";
import type { ViewMode } from "@/types";
import {
  BarChart3, TrendingUp, Package, Target, Receipt, DollarSign, Calculator
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "pal1" | "mty" | "consumption" | "kpis" | "direct_expenses" | "contribution" | "quote_builder";

const NAV_ITEMS: { id: TabId; label: string; blurb: string; icon: React.ElementType }[] = [
  { id: "pal1",             label: "PAL-1",           blurb: "Profit & loss statement",        icon: BarChart3 },
  { id: "mty",              label: "MTY",              blurb: "Month-to-year financial rollup", icon: TrendingUp },
  { id: "consumption",      label: "Consumption",      blurb: "Raw material movement & stock",  icon: Package },
  { id: "contribution",     label: "Contribution",     blurb: "Per-product margin analysis",    icon: DollarSign },
  { id: "quote_builder",    label: "Quote Builder",    blurb: "Price a single deal",             icon: Calculator },
  { id: "direct_expenses",  label: "Direct Expenses",  blurb: "Cost centre breakdown",           icon: Receipt },
  { id: "kpis",             label: "KPI Scorecard",    blurb: "Ratios & performance signals",    icon: Target },
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
    api.months(fy).then(({ months: m, latest_with_data }) => {
      setAvailableMonths(m);
      if (m.length > 0) {
        const defaultMonth = latest_with_data ?? m[m.length - 1];
        const idx = m.indexOf(defaultMonth);
        setMonths([defaultMonth]);
        setPrevMonths(idx > 0 ? [m[idx - 1]] : []);
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

  const active = NAV_ITEMS.find(n => n.id === activeTab)!;

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-lg bg-primary animate-pulse" />
        <p className="text-sm text-muted-foreground">Loading MIS data…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Command rail — persistent left navigation, pinned independent of page scroll */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 h-screen bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2.5 h-16 px-5 border-b border-sidebar-border/80">
          <img src="/Priyafil-Logo-PNG-Final.png" alt="PriyaFil" className="h-7 w-auto object-contain" />
          <p className="font-display text-sm font-semibold leading-none truncate">PriyaFil</p>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto slim-scrollbar">
          {NAV_ITEMS.map(({ id, label, blurb, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <Icon size={16} className={cn("shrink-0 mt-0.5", isActive ? "text-sidebar-primary" : "opacity-70")} />
                <span className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold leading-tight">{label}</span>
                  <span className="text-[11px] leading-tight opacity-60 truncate">{blurb}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border/80">
          <p className="text-[10px] text-sidebar-foreground/45 leading-relaxed px-1">
            Data refreshes monthly from Tally &amp; MIS exports.
          </p>
        </div>
      </aside>

      {/* Main column — scrolls independently, sidebar stays put */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-y-auto">
        {/* Top bar — page identity + global controls */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center h-12 px-5 gap-4">
            <div className="flex items-center gap-2.5 min-w-0 md:hidden">
              <img src="/Priyafil-Logo-PNG-Final.png" alt="PriyaFil" className="h-6 w-auto object-contain" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="font-display text-base font-semibold leading-tight text-foreground truncate">{active.label}</h1>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">{active.blurb}</p>
            </div>
            <div className="flex-1" />
            <TopBarRight availableMonths={availableMonths} fy={fy} availableFYs={availableFYs} />
          </div>

          {/* Mobile nav — visible only when the rail is hidden */}
          <nav className="flex md:hidden items-center gap-1 px-5 pb-2 overflow-x-auto no-scrollbar">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </nav>
        </header>

        <main className="px-5 py-3 flex flex-col gap-3 overflow-x-clip min-w-0">
          {/* Filters — period (FY/month) shown inline with the fiscal-year label, no separate headline row */}
          <FilterBar
            periodLabel={periodLabel(fy, viewMode, months)}
            availableMonths={availableMonths}
            availableFYs={availableFYs}
            fy={fy}
            viewMode={viewMode}
            selectedMonths={months}
            onFyChange={setFy}
            onViewModeChange={setViewMode}
            onMonthsChange={setMonths}
          />

          {/* Page content */}
          <div className="flex flex-col gap-4 min-w-0 overflow-x-clip">
            {activeTab === "pal1"            && <Pal1Page months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "mty"             && <MtyPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "consumption"     && <ConsumptionPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "kpis"            && <KpisPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "direct_expenses" && <DirectExpensesPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "contribution"    && <ContributionPage months={months} viewMode={viewMode} prevMonths={prevMonths} fy={fy} />}
            {activeTab === "quote_builder"   && <QuoteBuilderPage fy={fy} />}
          </div>
        </main>
      </div>
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
