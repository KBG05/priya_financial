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

export function Pal1Page({ months, viewMode, prevMonths, fy }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [prevData, setPrevData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]);   // all months for sparklines
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState("Gross Profit");
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        Promise.all([
            api.pal1(months, fy),
            prevMonths.length ? api.pal1(prevMonths, fy) : Promise.resolve({ data: [] }),
            api.pal1(allMonths, fy),
        ]).then(([r, p, all]) => {
            setData(r.data); setPrevData(p.data); setAllData(all.data);
            setLoading(false);
        });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
    );

    const g = (label: string) => getVal(data, "line_item", label, cur);
    const gp = (label: string) => getVal(prevData, "line_item", label, prev);
    const s = (items: string[], snap?: boolean) =>
        buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true, isSnapshot: snap });

    /** Historical series for sparklines — all months from Apr→cur for a given line item */
    const hist = (label: string): number[] =>
        MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1)
            .map(m => getVal(allData, "line_item", label, m))
            .filter((v): v is number => v != null);

    const HERO_CARDS = [
        { title: "Total Sales", lineItem: "Sales", deltaMode: "default" as const },
        { title: "Gross Profit", lineItem: "Gross Profit", deltaMode: "default" as const },
        { title: "Profit (A)", lineItem: "Profit (A)", deltaMode: "default" as const },
        { title: "NETT PROFIT", lineItem: "NETT PROFIT", deltaMode: "default" as const },
        { title: "Total Expenses", lineItem: "Total Expns", deltaMode: "inverse" as const },
    ];

    const comboItems = new Set([
        "Sales",
        "Op Stk",
        "Purchase-RM",
        "Purchase-Trading",
        "Purchase Yarn",
        "Purchase-Fabric+ Cons",
        "Cl Stk",
    ]);
    const trendOptions = [
        "Profit (A)",
        "NETT PROFIT",
        "Gross Profit",
        "Sales",
        "Op Stk",
        "Purchase-RM",
        "Purchase-Trading",
        "Purchase Yarn",
        "Purchase-Fabric+ Cons",
        "Cl Stk",
    ];
    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => {
        const row = allData.find(r => r.line_item === trendOption && r.month === m);
        const value = row?.value ?? 0;
        const qty = row?.qty ?? 0;
        const rate = row?.rate ?? (qty ? value / qty : 0);
        return { month: m, value, qty, rate };
    });
    const useCombo = comboItems.has(trendOption);

    const SECTIONS = [
        { title: "Revenue", items: ["Sales", "Waste", "Othr Inc"] },
        { title: "Purchases & Stock", snap: true, items: ["Op Stk", "Purchase-RM", "Purchase-Trading", "Purchase Yarn", "Purchase-Fabric+ Cons", "Cl Stk"] },
        { title: "Direct Expenses", items: ["Consumption", "Direct Expns", "In House Fabrn", "Fabrication", "Direct Cost"] },
        { title: "Overheads", items: ["Deprecition", "Indirect Expns", "Total Expns"] },
        { title: "Profits", items: ["Gross Profit", "Profit (A)", "NETT PROFIT"] },
    ];
    const { cols } = s(["Sales"]);

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <StatStrip
                leadFirst
                stats={HERO_CARDS.map(m => ({
                    title: m.title,
                    value: viewMode === "single"
                        ? g(m.lineItem)
                        : aggVal(data, "line_item", m.lineItem, months),
                    prevValue: gp(m.lineItem),
                    history: hist(m.lineItem),
                    rupee: true,
                    deltaMode: m.deltaMode as any
                }))}
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
                        rows: sec.items.map(item => ({ label: item, value: g(item) })),
                        sortRows: sec.title !== "Purchases & Stock" && sec.title !== "Profits",
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
