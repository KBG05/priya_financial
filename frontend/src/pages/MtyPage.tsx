import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/MetricCard";
import { SectionExpander } from "@/components/SectionExpander";
import { api } from "@/api";
import { buildLedgerData, getVal } from "@/lib/pivot";
import type { ViewMode } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

export function MtyPage({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [prevData, setPrevData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.mty(months),
            prevMonths.length ? api.mty(prevMonths) : Promise.resolve({ data: [] }),
        ]).then(([r, p]) => { setData(r.data); setPrevData(p.data); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return <div className="grid grid-cols-3 gap-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

    const g = (label: string) => getVal(data, "line_item", label, cur);
    const gp = (label: string) => getVal(prevData, "line_item", label, prev);
    const s = (items: string[], snap?: boolean) => buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true, isSnapshot: snap });

    const SECTIONS: any[] = [
        {
            title: "💰 Sales Analysis",
            items: ["Sales Monofil from Trading Fabric", "Sales Monofil From Production", "Sales Monofil from Trading Yarn", "Sales RM", "Sales Trading Others", "TOTAL SALES->"],
            heroes: [{ title: "Total Sales", value: g("TOTAL SALES->"), prevValue: gp("TOTAL SALES->"), rupee: true, deltaMode: "default" }],
        },
        {
            title: "📊 PAL I Breakdown",
            items: ["PAL I->", "PAL I (final)", "From Monofil Production", "From Monofil Trading Fabric", "MONOFIL TOTAL", "From RM Sales", "From Misc Trading", "From Other Income"],
            heroes: [
                { title: "PAL I", value: g("PAL I->"), prevValue: gp("PAL I->"), rupee: true, deltaMode: "default" },
                { title: "Monofil Total", value: g("MONOFIL TOTAL"), prevValue: gp("MONOFIL TOTAL"), rupee: true, deltaMode: "default" },
            ],
        },
        {
            title: "⚙️ Variable Costs",
            items: ["Variable-Yarn Cost", "Variable-Fabric Cost", "Variable-RM", "Variable-Others(Pigment+Master Batch)", "Variable-Trading", "Variable-Finance", "Total Variable"],
            heroes: [
                { title: "Total Variable", value: g("Total Variable"), prevValue: gp("Total Variable"), rupee: true, deltaMode: "neutral" },
                { title: "Variable-Yarn", value: g("Variable-Yarn Cost"), prevValue: gp("Variable-Yarn Cost"), rupee: true, deltaMode: "neutral" },
            ],
        },
        {
            title: "📦 Material & Stock", snap: true,
            items: ["Cl Stock RM", "Op stock RM", "Purchase RM", "Total Consumption", "PAL I Consumption"],
            heroes: [
                { title: "Total Consumption", value: g("Total Consumption"), prevValue: gp("Total Consumption"), rupee: true, deltaMode: "neutral" },
                { title: "Closing Stock RM", value: g("Cl Stock RM"), prevValue: gp("Cl Stock RM"), rupee: true, deltaMode: "neutral" },
            ],
        },
        {
            title: "🏭 COGS",
            items: ["COGS Monofil", "COGS Misc Trading"],
            heroes: [{ title: "COGS Monofil", value: g("COGS Monofil"), prevValue: gp("COGS Monofil"), rupee: true, deltaMode: "inverse" }],
        },
        {
            title: "📈 Profitability",
            items: ["Gross Profit", "Operating Expns Sal/Adm/Sell", "Operating Profit/EBIT", "EBITDA", "Finance Cost", "Deprn (EBITDA)", "Nett Profit"],
            heroes: [
                { title: "Gross Profit", value: g("Gross Profit"), prevValue: gp("Gross Profit"), rupee: true, deltaMode: "default" },
                { title: "EBITDA", value: g("EBITDA"), prevValue: gp("EBITDA"), rupee: true, deltaMode: "default" },
                { title: "Nett Profit", value: g("Nett Profit"), prevValue: gp("Nett Profit"), rupee: true, deltaMode: "default" },
            ],
        },
        {
            title: "📋 Fixed Costs",
            items: ["Fixed Cost", "Salaries", "Admn", "Selling", "Deprnn", "Interest USL"],
            heroes: [
                { title: "Fixed Cost", value: g("Fixed Cost"), prevValue: gp("Fixed Cost"), rupee: true, deltaMode: "inverse" },
                { title: "Salaries", value: g("Salaries"), prevValue: gp("Salaries"), rupee: true, deltaMode: "inverse" },
            ],
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* MTY-specific top cards with sales=default, variable=neutral, profit=default */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricCard title="Total Sales" value={g("TOTAL SALES->")} prevValue={gp("TOTAL SALES->")} rupee deltaMode="default" />
                <MetricCard title="Total Variable" value={g("Total Variable") ?? g("Variable & Direct Expense")} prevValue={gp("Total Variable") ?? gp("Variable & Direct Expense")} rupee deltaMode="neutral" />
                <MetricCard title="Nett Profit" value={g("Nett Profit")} prevValue={gp("Nett Profit")} rupee deltaMode="default" />
            </div>

            {SECTIONS.map(sec => {
                const { cols, rows } = s(sec.items, sec.snap);
                return <SectionExpander key={sec.title} title={sec.title} heroes={sec.heroes} cols={cols} rows={rows} />;
            })}
        </div>
    );
}
