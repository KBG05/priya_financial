import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, TrendingUp, Receipt, Package, Tags, Activity, FileSpreadsheet, Calculator,
} from "lucide-react";
import { TopBarRight } from "@/components/TopBarRight";
import { ThemeProvider } from "@/hooks/useTheme";
import { useRoute, type PageId } from "@/hooks/useRoute";
import { useReview } from "@/hooks/useReview";
import { api } from "@/api";
import { MONTH_ORDER, type Month } from "@/types";
import { fyLabel, label, sameMonthLastYear, previous, type Period } from "@/lib/period";
import { ErrorPanel, PageSkeleton, EmptyMonth } from "@/components/review/parts";
import { OverviewPage } from "@/pages/OverviewPage";
import { ProfitPage } from "@/pages/ProfitPage";
import { CostsPage } from "@/pages/CostsPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { HealthPage } from "@/pages/HealthPage";
import { StatementsPage } from "@/pages/StatementsPage";
import { QuoteBuilderPage } from "@/pages/QuoteBuilderPage";
import { cn } from "@/lib/utils";

const NAV: { id: PageId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profit", label: "Profit & Margin", icon: TrendingUp },
  { id: "costs", label: "Costs", icon: Receipt },
  { id: "inventory", label: "Inventory & Materials", icon: Package },
  { id: "products", label: "Products & Pricing", icon: Tags },
  { id: "health", label: "Financial Health", icon: Activity },
  { id: "statements", label: "Statements", icon: FileSpreadsheet },
];
const TOOLS: typeof NAV = [{ id: "quote", label: "Quote Builder", icon: Calculator }];
const TITLES: Record<PageId, string> = Object.fromEntries([...NAV, ...TOOLS].map(n => [n.id, n.label])) as Record<PageId, string>;

/** Months that actually hold figures, per FY (a month with zero sales is treated as not uploaded). */
async function loadCalendar(): Promise<{ fys: string[]; withData: Record<string, Month[]> }> {
  const { fy_list, default: def } = await api.fyList();
  const fys = (fy_list.length ? fy_list : [def]).slice().sort();
  const withData: Record<string, Month[]> = {};
  await Promise.all(fys.map(async fy => {
    const { data } = await api.mty([...MONTH_ORDER], fy);
    withData[fy] = MONTH_ORDER.filter(m => (data as { month: string; line_item: string; value: number | null }[]).some(r => r.month === m && r.line_item === "TOTAL SALES->" && (r.value ?? 0) > 0));
  }));
  return { fys, withData };
}

function Dashboard() {
  const { route, navigate } = useRoute();
  const [calendar, setCalendar] = useState<{ fys: string[]; withData: Record<string, Month[]> } | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarAttempt, setCalendarAttempt] = useState(0);

  useEffect(() => {
    setCalendarError(null);
    loadCalendar().then(setCalendar).catch(e => setCalendarError(e instanceof Error ? e.message : String(e)));
  }, [calendarAttempt]);

  // The latest month with figures is the default period.
  const latest: Period | null = useMemo(() => {
    if (!calendar) return null;
    for (const fy of [...calendar.fys].reverse()) {
      const ms = calendar.withData[fy];
      if (ms?.length) return { fy, month: ms[ms.length - 1] };
    }
    return null;
  }, [calendar]);

  const period: Period | null = route.fy && route.month ? { fy: route.fy, month: route.month } : latest;
  const hasData = !!(period && calendar?.withData[period.fy]?.includes(period.month));
  const review = useReview(hasData ? period : null, calendar?.fys ?? []);
  const isQuote = route.page === "quote";

  const go = (page: PageId) => navigate({ page });

  let body: React.ReactNode;
  if (calendarError) body = <ErrorPanel message={calendarError} onRetry={() => setCalendarAttempt(a => a + 1)} />;
  else if (isQuote) body = <QuoteBuilderPage fy={period?.fy ?? calendar?.fys.at(-1) ?? ""} />;
  else if (!calendar || !period) body = <PageSkeleton />;
  else if (!hasData) body = <EmptyMonth month={label(period)} />;
  else if (review.status === "error" && !review.review) body = <ErrorPanel message={review.error} onRetry={review.retry} />;
  else if (!review.review || review.review.cur.period.month !== period.month || review.review.cur.period.fy !== period.fy) body = <PageSkeleton />;
  else {
    const props = { review: review.review, compare: route.compare, go };
    body = (
      <div key={`${route.page}:${period.fy}:${period.month}:${route.compare}`} className="flex flex-col gap-6">
        {route.page === "overview" && <OverviewPage {...props} />}
        {route.page === "profit" && <ProfitPage {...props} />}
        {route.page === "costs" && <CostsPage {...props} />}
        {route.page === "inventory" && <InventoryPage {...props} />}
        {route.page === "products" && <ProductsPage {...props} />}
        {route.page === "health" && <HealthPage {...props} />}
        {route.page === "statements" && <StatementsPage {...props} />}
      </div>
    );
  }

  const NavLink = ({ id, label: text, icon: Icon, compact }: { id: PageId; label: string; icon: React.ElementType; compact?: boolean }) => {
    const active = route.page === id;
    return (
      <a
        href={`#/${id}${window.location.hash.includes("?") ? "?" + window.location.hash.split("?")[1] : ""}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg font-semibold transition-colors whitespace-nowrap",
          compact ? "px-3 py-1.5 text-[13px]" : "px-3 py-2",
          active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Icon size={17} aria-hidden className="shrink-0" />
        {text}
      </a>
    );
  };

  const latestLabel = latest ? label(latest) : "—";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-card focus:px-3 focus:py-2 focus:rounded-lg">Skip to content</a>

      <aside className="hidden lg:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 bg-card border-r border-border">
        <div className="flex items-center gap-2.5 h-[60px] px-5">
          <img src="/Priyafil-Logo-PNG-Final.png" alt="" className="h-7 w-auto object-contain" />
          <span className="font-extrabold text-[17px] tracking-[-0.01em]">PriyaFil</span>
        </div>
        <nav aria-label="Business review" className="flex flex-col gap-0.5 px-3 pt-3">
          {NAV.map(n => <NavLink key={n.id} {...n} />)}
        </nav>
        <nav aria-label="Tools" className="flex flex-col gap-0.5 px-3 mt-4 pt-4 border-t border-border mx-3 !px-0">
          <p className="px-3 pb-1 text-[12.5px] font-semibold text-muted-foreground">Tools</p>
          {TOOLS.map(n => <NavLink key={n.id} {...n} />)}
        </nav>
        <div className="mt-auto px-5 py-4 border-t border-border text-[13px] text-muted-foreground">
          Latest figures: <span className="font-semibold text-foreground">{latestLabel}</span>
          <p className="mt-0.5">From the monthly Tally and MIS upload.</p>
        </div>
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-h-[60px] px-4 md:px-8 py-2">
            <img src="/Priyafil-Logo-PNG-Final.png" alt="PriyaFil" className="h-6 w-auto object-contain lg:hidden" />
            <h1 className="text-[15px] font-bold mr-auto">{TITLES[route.page]}</h1>
            {!isQuote && calendar && period && (
              <PeriodControls
                calendar={calendar}
                period={period}
                compare={route.compare}
                onPeriod={p => navigate({ fy: p.fy, month: p.month })}
                onCompare={c => navigate({ compare: c })}
              />
            )}
            <TopBarRight availableMonths={[...MONTH_ORDER]} fy={period?.fy ?? ""} availableFYs={calendar?.fys ?? []} onUploaded={() => setCalendarAttempt(a => a + 1)} />
          </div>
          <nav aria-label="Business review" className="lg:hidden flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
            {[...NAV, ...TOOLS].map(n => <NavLink key={n.id} {...n} compact />)}
          </nav>
        </header>

        <main id="main" className="flex-1 px-4 md:px-8 py-6 md:py-8 min-w-0 max-w-[1320px] w-full">
          {body}
        </main>
      </div>
    </div>
  );
}

function PeriodControls({ calendar, period, compare, onPeriod, onCompare }: {
  calendar: { fys: string[]; withData: Record<string, Month[]> };
  period: Period;
  compare: "prev" | "ly";
  onPeriod: (p: Period) => void;
  onCompare: (c: "prev" | "ly") => void;
}) {
  const value = `${period.fy}:${period.month}`;
  const prevP = previous(period);
  const lyP = sameMonthLastYear(period);
  const has = (p: Period) => !!calendar.withData[p.fy]?.includes(p.month);
  const segment = (c: "prev" | "ly", text: string, enabled: boolean) => (
    <button
      type="button"
      onClick={() => onCompare(c)}
      disabled={!enabled}
      aria-pressed={compare === c}
      title={enabled ? undefined : "No figures uploaded for that month"}
      className={cn(
        "px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed",
        compare === c ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {text}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="period">Month</label>
      <select
        id="period"
        value={value}
        onChange={e => { const [fy, month] = e.target.value.split(":"); onPeriod({ fy, month: month as Month }); }}
        className="h-9 rounded-lg border border-input bg-card px-3 pr-8 font-semibold text-[14px] cursor-pointer"
      >
        {[...calendar.fys].reverse().map(fy => (
          <optgroup key={fy} label={fyLabel(fy)}>
            {[...(calendar.withData[fy] ?? [])].reverse().map(m => (
              <option key={m} value={`${fy}:${m}`}>{label({ fy, month: m })} · {fyLabel(fy)}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <div role="group" aria-label="Compare with" className="flex items-center rounded-lg bg-muted p-0.5">
        {segment("prev", `vs ${label(prevP)}`, has(prevP))}
        {segment("ly", `vs ${label(lyP)}`, has(lyP))}
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
