import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/MetricCard";
import { SectionExpander } from "@/components/SectionExpander";
import { api } from "@/api";
import { buildLedgerData, getVal } from "@/lib/pivot";
import type { ViewMode } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

export function Pal1Page({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [prevData, setPrevData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.pal1(months),
            prevMonths.length ? api.pal1(prevMonths) : Promise.resolve({ data: [] }),
        ]).then(([r, p]) => { setData(r.data); setPrevData(p.data); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return <div className="grid grid-cols-5 gap-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

    const g = (label: string) => getVal(data, "line_item", label, cur);
    const gp = (label: string) => getVal(prevData, "line_item", label, prev);
    const s = (items: string[], snap?: boolean) => buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true, isSnapshot: snap });

    return (
        <div className="flex flex-col gap-4">
            {/* Hero cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { title: "Total Sales", value: g("Sales"), prev: gp("Sales") },
                    { title: "Gross Profit", value: g("Gross Profit"), prev: gp("Gross Profit") },
                    { title: "Profit (A)", value: g("Profit (A)"), prev: gp("Profit (A)") },
                    { title: "NETT PROFIT", value: g("NETT PROFIT"), prev: gp("NETT PROFIT") },
                    { title: "Total Expenses", value: g("Total Expns"), prev: gp("Total Expns"), inverse: true },
                ].map(m => (
                    <MetricCard key={m.title} title={m.title} value={m.value} prevValue={m.prev}
                        rupee deltaMode={m.inverse ? "inverse" : "default"} />
                ))}
            </div>

            {/* Sections */}
            {([
                {
                    title: "💰 Revenue",
                    items: ["Sales", "Waste", "Othr Inc"],
                    heroes: [{ title: "Sales", value: g("Sales"), prevValue: gp("Sales"), rupee: true as const }],
                },
                {
                    title: "📦 Purchases & Stock", snap: true,
                    items: ["Op Stk", "Purchase-RM", "Purchase-Trading", "Purchase Yarn", "Purchase-Fabric+ Cons", "Cl Stk"],
                    heroes: [
                        { title: "Opening Stock", value: g("Op Stk"), prevValue: gp("Op Stk"), rupee: true as const, deltaMode: "neutral" as const },
                        { title: "Purchase-RM", value: g("Purchase-RM"), prevValue: gp("Purchase-RM"), rupee: true as const, deltaMode: "inverse" as const },
                        { title: "Closing Stock", value: g("Cl Stk"), prevValue: gp("Cl Stk"), rupee: true as const, deltaMode: "neutral" as const },
                    ],
                },
                {
                    title: "🔧 Direct Expenses",
                    items: ["Consumption", "Direct Expns", "In House Fabrn", "Fabrication", "Direct Cost"],
                    heroes: [{ title: "Direct Cost", value: g("Direct Cost"), prevValue: gp("Direct Cost"), rupee: true as const, deltaMode: "inverse" as const }],
                },
                {
                    title: "📋 Overheads",
                    items: ["Deprecition", "Indirect Expns", "Total Expns"],
                    heroes: [{ title: "Total Overheads", value: g("Total Expns"), prevValue: gp("Total Expns"), rupee: true as const, deltaMode: "inverse" as const }],
                },
                {
                    title: "📈 Profits",
                    items: ["Gross Profit", "Profit (A)", "NETT PROFIT"],
                    heroes: [
                        { title: "Gross Profit", value: g("Gross Profit"), prevValue: gp("Gross Profit"), rupee: true as const },
                        { title: "Profit (A)", value: g("Profit (A)"), prevValue: gp("Profit (A)"), rupee: true as const },
                        { title: "NETT PROFIT", value: g("NETT PROFIT"), prevValue: gp("NETT PROFIT"), rupee: true as const },
                    ],
                },
            ] as any[]).map(sec => {
                const { cols, rows } = s(sec.items, sec.snap);
                return <SectionExpander key={sec.title} title={sec.title} heroes={sec.heroes} cols={cols} rows={rows} />;
            })}
        </div>
    );
}
