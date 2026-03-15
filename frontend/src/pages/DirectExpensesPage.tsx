import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailedBreakdown } from "@/components/DetailedBreakdown";
import { TrendChart } from "@/components/TrendChart";
import { HeroMetricsPanel } from "@/components/HeroMetricsPanel";
import { api } from "@/api";
import { buildLedgerData } from "@/lib/pivot";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

export function DirectExpensesPage({ months, viewMode }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState("Total");
    const cur = months[months.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        Promise.all([
            api.directExpenses(months),
            api.directExpenses(allMonths),
        ]).then(([r, all]) => {
            setData(r.data);
            setAllData(all.data);
            setLoading(false);
        });
    }, [months.join(",")]);

    if (loading) return <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

    const categories = [...new Set(data.map((r: any) => r.category))].sort();

    const trendOptions = ["Variable & direct expense", "Fixed Cost", "Total"];

    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => {
        const monthRows = allData.filter(r => r.month === m);
        let val = 0;
        if (trendOption === "Total") {
            val = monthRows.reduce((sum, r) => sum + (r.value ?? 0), 0);
        } else {
            val = monthRows.filter(r => r.category === trendOption).reduce((sum, r) => sum + (r.value ?? 0), 0);
        }
        return { month: m, value: val };
    });

    const curTotal = data.filter(r => r.month === cur).reduce((s, r) => s + (r.value ?? 0), 0);

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
                        rupee
                    />
                </div>
                <HeroMetricsPanel
                    metrics={[
                        { title: "Total Direct Expenses", value: curTotal, prevValue: undefined, rupee: true, deltaMode: "inverse" }
                    ]}
                />
            </div>

            <DetailedBreakdown sections={categories.map(cat => {
                const items = [...new Set(data.filter((r: any) => r.category === cat).map((r: any) => r.line_item))];
                const { cols, rows } = buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true });
                return { title: `📂 ${cat}`, cols, rows };
            })} />
        </div>
    );
}
