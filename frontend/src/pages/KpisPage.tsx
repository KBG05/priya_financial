import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/MetricCard";
import { GroupedKpiTable, type KpiGroup } from "@/components/GroupedKpiTable";
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
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        // fetch all months for table + sparklines in one call
        api.kpis(allMonths).then(r => { setAllData(r.data); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="flex flex-col gap-4">
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

    return (
        <div className="flex flex-col gap-4">
            {/* 4 KPI highlight cards with sparkline */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {HIGHLIGHT_KPIS.map(name => {
                    const v = kv(name, cur);
                    const p = kv(name, prev);
                    const history = sparkSeries(name);
                    return (
                        <MetricCard
                            key={name}
                            title={name}
                            value={v}
                            prevValue={p}
                            pct
                            history={history}
                            deltaMode="default"
                        />
                    );
                })}
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
