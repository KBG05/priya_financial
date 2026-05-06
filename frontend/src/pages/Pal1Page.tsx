import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/TrendChart";
import { DetailedBreakdown } from "@/components/DetailedBreakdown";
import { HeroMetricsPanel } from "@/components/HeroMetricsPanel";
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
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
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

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            {/* Top Section: Chart on Left, Stacked Hero Cards on Right */}
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 min-w-0">
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
                </div>
                <HeroMetricsPanel
                    metrics={HERO_CARDS.map(m => ({
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
            </div>

            <DetailedBreakdown sections={([
                {
                    title: "💰 Revenue",
                    items: ["Sales", "Waste", "Othr Inc"],
                    heroes: [
                        { title: "Sales", value: g("Sales"), prevValue: gp("Sales"), history: hist("Sales"), rupee: true as const, deltaMode: "default" as const },
                    ],
                },
                {
                    title: "📦 Purchases & Stock", snap: true,
                    items: ["Op Stk", "Purchase-RM", "Purchase-Trading", "Purchase Yarn", "Purchase-Fabric+ Cons", "Cl Stk"],
                    heroes: [
                        { title: "Opening Stock", value: g("Op Stk"), prevValue: gp("Op Stk"), history: hist("Op Stk"), rupee: true as const, deltaMode: "neutral" as const },
                        { title: "Purchase-RM", value: g("Purchase-RM"), prevValue: gp("Purchase-RM"), history: hist("Purchase-RM"), rupee: true as const, deltaMode: "inverse" as const },
                        { title: "Closing Stock", value: g("Cl Stk"), prevValue: gp("Cl Stk"), history: hist("Cl Stk"), rupee: true as const, deltaMode: "neutral" as const },
                    ],
                },
                {
                    title: "🔧 Direct Expenses",
                    items: ["Consumption", "Direct Expns", "In House Fabrn", "Fabrication", "Direct Cost"],
                    heroes: [
                        { title: "Direct Cost", value: g("Direct Cost"), prevValue: gp("Direct Cost"), history: hist("Direct Cost"), rupee: true as const, deltaMode: "inverse" as const },
                    ],
                },
                {
                    title: "📋 Overheads",
                    items: ["Deprecition", "Indirect Expns", "Total Expns"],
                    heroes: [
                        { title: "Total Overheads", value: g("Total Expns"), prevValue: gp("Total Expns"), history: hist("Total Expns"), rupee: true as const, deltaMode: "inverse" as const },
                    ],
                },
                {
                    title: "📈 Profits",
                    items: ["Gross Profit", "Profit (A)", "NETT PROFIT"],
                    heroes: [
                        { title: "Gross Profit", value: g("Gross Profit"), prevValue: gp("Gross Profit"), history: hist("Gross Profit"), rupee: true as const, deltaMode: "default" as const },
                        { title: "Profit (A)", value: g("Profit (A)"), prevValue: gp("Profit (A)"), history: hist("Profit (A)"), rupee: true as const, deltaMode: "default" as const },
                        { title: "NETT PROFIT", value: g("NETT PROFIT"), prevValue: gp("NETT PROFIT"), history: hist("NETT PROFIT"), rupee: true as const, deltaMode: "default" as const },
                    ],
                },
            ] as any[]).map(sec => {
                const { cols, rows } = s(sec.items, sec.snap);
                return { title: sec.title, cols, rows, heroes: sec.heroes };
            })} />
        </div>
    );
}
