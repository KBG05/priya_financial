import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerBoard } from "@/components/LedgerBoard";
import { BreakdownGrid } from "@/components/BreakdownGrid";
import { TrendChart } from "@/components/TrendChart";
import { StatStrip } from "@/components/StatStrip";
import { api } from "@/api";
import { buildLedgerData } from "@/lib/pivot";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; fy?: string; }

export function DirectExpensesPage({ months, viewMode, fy }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState("Total");
    const cur = months[months.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        Promise.all([
            api.directExpenses(months, fy),
            api.directExpenses(allMonths, fy),
        ]).then(([r, all]) => {
            setData(r.data);
            setAllData(all.data);
            setLoading(false);
        });
    }, [months.join(",")]);

    if (loading) return <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

    const categories = [...new Set(data.map((r: any) => r.category))].sort();
    const lineItems = [...new Set(data.map((r: any) => r.line_item))].sort();

    const trendOptions = ["Total", ...categories, ...lineItems];

    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => {
        const monthRows = allData.filter(r => r.month === m);
        let val = 0;
        if (trendOption === "Total") {
            val = monthRows.reduce((sum, r) => sum + (r.value ?? 0), 0);
        } else if (categories.includes(trendOption)) {
            val = monthRows.filter(r => r.category === trendOption).reduce((sum, r) => sum + (r.value ?? 0), 0);
        } else {
            val = monthRows.filter(r => r.line_item === trendOption).reduce((sum, r) => sum + (r.value ?? 0), 0);
        }
        return { month: m, value: val };
    });

    const curTotal = viewMode === "single"
        ? data.filter(r => r.month === cur).reduce((s, r) => s + (r.value ?? 0), 0)
        : data.filter(r => months.includes(r.month)).reduce((s, r) => s + (r.value ?? 0), 0);

    const catTotal = (cat: string) => data
        .filter(r => (viewMode === "single" ? r.month === cur : months.includes(r.month)) && r.category === cat)
        .reduce((s, r) => s + (r.value ?? 0), 0);

    const groupsRaw = categories.map(cat => {
        const items = [...new Set(data.filter((r: any) => r.category === cat).map((r: any) => r.line_item))];
        return { title: cat, ...buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true }) };
    });
    const cols = groupsRaw[0]?.cols ?? [{ key: "line_item", header: "Item", isLabel: true }];

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <StatStrip
                leadFirst
                stats={[
                    { title: "Total Direct Expenses", value: curTotal, prevValue: undefined, rupee: true, deltaMode: "inverse" },
                    ...categories.slice(0, 4).map(cat => ({ title: cat, value: catTotal(cat), rupee: true, deltaMode: "neutral" as const })),
                ]}
            />

            <TrendChart
                title={`${trendOption} Trend`}
                data={trendData}
                dataKey="value"
                options={trendOptions}
                selectedOption={trendOption}
                onOptionChange={setTrendOption}
                rupee
            />

            {viewMode === "single" ? (
                <BreakdownGrid
                    rupee
                    groups={categories.map(cat => ({
                        title: cat,
                        rows: [...new Set(data.filter((r: any) => r.category === cat).map((r: any) => r.line_item))]
                            .map(item => ({
                                label: item,
                                value: data.find((r: any) => r.category === cat && r.line_item === item && r.month === cur)?.value ?? null,
                            })),
                    }))}
                />
            ) : (
                <LedgerBoard
                    cols={cols}
                    defaultOpenCount={2}
                    groups={groupsRaw.map(g => ({ title: g.title, rows: g.rows }))}
                />
            )}
        </div>
    );
}
