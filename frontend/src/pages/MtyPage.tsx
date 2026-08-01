import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/TrendChart";
import { LedgerBoard } from "@/components/LedgerBoard";
import { BreakdownGrid } from "@/components/BreakdownGrid";
import { StatStrip } from "@/components/StatStrip";
import { api } from "@/api";
import { buildLedgerData, getVal, aggVal } from "@/lib/pivot";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; fy?: string; }

export function MtyPage({ months, viewMode, prevMonths, fy }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [prevData, setPrevData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState("Nett Profit");
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        Promise.all([
            api.mty(months, fy),
            prevMonths.length ? api.mty(prevMonths, fy) : Promise.resolve({ data: [] }),
            api.mty(allMonths, fy),
        ]).then(([r, p, all]) => {
            setData(r.data); setPrevData(p.data); setAllData(all.data);
            setLoading(false);
        });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
    );

    const g = (label: string) => getVal(data, "line_item", label, cur);
    const gp = (label: string) => getVal(prevData, "line_item", label, prev);
    // agg: sum across selected months for flow items, last-month for snapshot items
    const agg = (label: string, snap = false) =>
        viewMode === "single" ? g(label) : aggVal(data, "line_item", label, months, { snapshot: snap });
    const s = (items: string[], snap?: boolean) =>
        buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true, isSnapshot: snap });

    const hist = (label: string): number[] =>
        MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1)
            .map(m => getVal(allData, "line_item", label, m))
            .filter((v): v is number => v != null);

    const comboItems = new Set([
        "Sales Monofil from Trading Fabric",
        "Sales Monofil From Production",
        "Sales Monofil from Trading Yarn",
        "Sales RM",
        "Sales Trading Others",
        "Purchase RM",
        "Monofil Purchase Yarn",
        "Monofil Purchase Fabric",
        "Trading Purchase",
        "Op stock RM",
        "Cl Stock RM",
    ]);

    const SECTIONS: any[] = [
        {
            title: "Sales Analysis",
            items: ["Sales Monofil from Trading Fabric", "Sales Monofil From Production", "Sales Monofil from Trading Yarn", "Sales RM", "Sales Trading Others", "TOTAL SALES->"],
        },
        {
            title: "PAL I Breakdown",
            items: ["PAL I->", "PAL I (final)", "From Monofil Production", "From Monofil Trading Fabric", "MONOFIL TOTAL", "From RM Sales", "From Misc Trading", "From Other Income"],
        },
        {
            title: "Variable Costs",
            items: ["Variable-Yarn Cost", "Variable-Fabric Cost", "Variable-RM", "Variable-Others(Pigment+Master Batch)", "Variable-Trading", "Variable-Finance", "Total Variable"],
        },
        {
            title: "Material & Stock", snap: true,
            items: ["Cl Stock RM", "Op stock RM", "Purchase RM", "Total Consumption", "PAL I Consumption"],
        },
        {
            title: "Profitability",
            items: ["Gross Profit", "Operating Expns Sal/Adm/Sell", "Operating Profit/EBIT", "EBITDA", "Finance Cost", "Deprn (EBITDA)", "Nett Profit"],
        },
        {
            title: "Fixed Costs",
            items: ["Fixed Cost", "Salaries", "Admn", "Selling", "Deprnn", "Interest USL"],
        },
    ];

    const trendOptions = [
        "Nett Profit",
        "Gross Profit",
        "EBITDA",
        "Sales Monofil from Trading Fabric",
        "Sales Monofil From Production",
        "Sales Monofil from Trading Yarn",
        "Sales RM",
        "Sales Trading Others",
        "Purchase RM",
        "Monofil Purchase Yarn",
        "Monofil Purchase Fabric",
        "Trading Purchase",
        "Op stock RM",
        "Cl Stock RM",
    ];
    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => {
        const row = allData.find(r => r.line_item === trendOption && r.month === m);
        const value = row?.value ?? 0;
        const qty = row?.qty ?? 0;
        return {
            month: m,
            value,
            qty,
            rate: qty ? value / qty : 0,
        };
    });
    const useCombo = comboItems.has(trendOption);
    const { cols } = s(["Nett Profit"]);

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <StatStrip
                leadFirst
                stats={[
                    { title: "Total Sales", value: agg("TOTAL SALES->"), prevValue: gp("TOTAL SALES->"), history: hist("TOTAL SALES->"), rupee: true, deltaMode: "default" },
                    { title: "Total Variable", value: agg("Total Variable") ?? agg("Variable & Direct Expense"), prevValue: gp("Total Variable") ?? gp("Variable & Direct Expense"), history: hist("Total Variable"), rupee: true, deltaMode: "neutral" },
                    { title: "Nett Profit", value: agg("Nett Profit"), prevValue: gp("Nett Profit"), history: hist("Nett Profit"), rupee: true, deltaMode: "default" },
                ]}
            />

            <TrendChart
                title={`${trendOption} Trend`}
                data={trendData}
                dataKey="value"
                combo={useCombo}
                barKey={useCombo ? "value" : undefined}
                lineKey={useCombo ? "rate" : undefined}
                qtyKey={useCombo ? "qty" : undefined}
                options={trendOptions}
                selectedOption={trendOption}
                onOptionChange={setTrendOption}
                rupee
                barRupee
                lineRupee
            />

            {viewMode === "single" ? (
                <BreakdownGrid
                    rupee
                    groups={SECTIONS.map(sec => ({
                        title: sec.title,
                        rows: sec.items.map((item: string) => ({ label: item, value: g(item) })),
                        sortRows: !["PAL I Breakdown", "Material & Stock", "Profitability"].includes(sec.title),
                    }))}
                />
            ) : (
                <LedgerBoard
                    cols={cols}
                    defaultOpenCount={2}
                    groups={SECTIONS.map(sec => ({ title: sec.title, rows: s(sec.items, sec.snap).rows }))}
                />
            )}
        </div>
    );
}
