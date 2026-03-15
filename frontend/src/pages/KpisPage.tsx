import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupedKpiTable, type KpiGroup } from "@/components/GroupedKpiTable";
import { TrendChart } from "@/components/TrendChart";
import { HeroMetricsPanel } from "@/components/HeroMetricsPanel";
import { api } from "@/api";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

const KPI_GROUPS: KpiGroup[] = [
    { label: "Profitability", items: ["Revenue growth", "Gross margin", "EBITDA", "Net Margin"] },
    { label: "Liquidity", items: ["CCC (cash conversion cycle)", "DIO (Days Inventory Outstanding)", "DSO (Days sales Outstanding)", "DPO (Days Payable Outstanding)", "Current Ratio", "Quick Ratio"] },
    { label: "Leverage", items: ["Debt Equity", "Debt Coverage", "Interest Coverage"] },
    { label: "Market Metrics", items: ["EPS", "PE Ratio", "EV (Enterprise Value)"] },
];

const HIGHLIGHT_KPIS = ["Revenue growth", "Gross margin", "EBITDA", "Net Margin"];

export function KpisPage({ months, viewMode, prevMonths }: Props) {
    const [allData, setAllData] = useState<any[]>([]); // all months for sparklines  
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState("Revenue growth");
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        // fetch all months for table + sparklines in one call
        api.kpis(allMonths).then(r => { setAllData(r.data); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
            <Skeleton className="h-80" />
        </div>
    );

    const kv = (name: string, month: string): number | null =>
        allData.find(r => r.kpi_name === name && r.month === month)?.value ?? null;

    /** Historical series for sparkline — all months from Apr up to cur */
    const sparkSeries = (name: string): number[] =>
        MONTH_ORDER
            .slice(0, MONTH_ORDER.indexOf(cur as any) + 1)
            .map(m => kv(name, m))
            .filter((v): v is number => v != null);

    const trendOptions = KPI_GROUPS.flatMap(g => g.items);
    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => ({
        month: m,
        value: kv(trendOption, m) ?? 0
    }));

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 min-w-0">
                    <TrendChart
                        title={`${trendOption} Trend`}
                        data={trendData}
                        dataKey="value"
                        options={trendOptions}
                        selectedOption={trendOption}
                        onOptionChange={setTrendOption}
                        pct={trendOption !== "EPS" && trendOption !== "EV (Enterprise Value)" && trendOption !== "PE Ratio" && !trendOption.includes("Days")}
                    />
                </div>
                {/* 4 KPI highlight cards with sparkline */}
                <HeroMetricsPanel
                    metrics={HIGHLIGHT_KPIS.map(name => ({
                        title: name,
                        value: kv(name, cur),
                        prevValue: kv(name, prev),
                        history: sparkSeries(name),
                        pct: true,
                        deltaMode: "default"
                    }))}
                />
            </div>

            {/* Grouped collapsible KPI table */}
            <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">All KPIs</p>
                <GroupedKpiTable
                    groups={KPI_GROUPS}
                    allData={allData}
                    months={months}
                    viewMode={viewMode}
                    curMonth={cur}
                />
            </div>
        </div>
    );
}
