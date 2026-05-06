import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendChart } from "@/components/TrendChart";
import { DetailedBreakdown } from "@/components/DetailedBreakdown";
import { HeroMetricsPanel } from "@/components/HeroMetricsPanel";
import type { ColDef } from "@/components/LedgerTable";
import { api } from "@/api";
import { fmt } from "@/lib/format";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; fy?: string; }
interface MatRow { month: string; material: string;[k: string]: any; }

export function ConsumptionPage({ months, viewMode, prevMonths, fy }: Props) {
    const [data, setData] = useState<MatRow[]>([]);
    const [prevData, setPrevData] = useState<MatRow[]>([]);
    const [allData, setAllData] = useState<MatRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [trendOption, setTrendOption] = useState<string>("");

    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    const materials = [...new Set(data.map(r => r.material))];

    useEffect(() => {
        if (!trendOption && materials.length) setTrendOption(materials[0]);
    }, [materials, trendOption]);

    useEffect(() => {
        setLoading(true);
        const allMonths = MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        Promise.all([
            api.consumption(months, fy),
            prevMonths.length ? api.consumption(prevMonths, fy) : Promise.resolve({ data: [] }),
            api.consumption(allMonths, fy),
        ]).then(([r, p, all]) => { setData(r.data as MatRow[]); setPrevData(p.data as MatRow[]); setAllData(all.data as MatRow[]); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
    );

    const curData = data.filter(r => r.month === cur);
    const prevCurData = prevData.filter(r => r.month === prev);
    // For multi-month view, aggregate across all selected months
    const aggData = viewMode === "single" ? curData : data.filter(r => months.includes(r.month));
    const totVal = aggData.reduce((s, r) => s + (r.value ?? 0), 0);
    const totQty = aggData.reduce((s, r) => s + (r.qty ?? 0), 0);
    const prevTotVal = prevCurData.reduce((s, r) => s + (r.value ?? 0), 0);
    const prevTotQty = prevCurData.reduce((s, r) => s + (r.qty ?? 0), 0);

    const COMPS = [
        { label: "Opening Stock", qk: "opening_stock_qty", vk: "opening_stock_value" },
        { label: "Purchases", qk: "purchases_qty", vk: "purchases_value" },
        { label: "Sales", qk: "sales_qty", vk: "sales_value" },
        { label: "Closing Stock", qk: "closing_stock_qty", vk: "closing_stock_value" },
        { label: "Consumption", qk: "qty", vk: "value", rk: "rate" },
    ];

    const trendData = MONTH_ORDER.slice(0, MONTH_ORDER.indexOf(cur as any) + 1).map(m => {
        const matRow = allData.find(r => r.material === trendOption && r.month === m);
        return {
            month: m,
            value: matRow?.value ?? 0,
            rate: matRow?.rate ?? (matRow?.qty ? (matRow.value / matRow.qty) : 0),
            qty: matRow?.qty ?? 0,
        };
    });

    const buildMatTable = (mat: string): { cols: ColDef[]; rows: Record<string, string>[] } => {
        const avail = months.filter(m => data.some(r => r.material === mat && r.month === m));
        if (viewMode === "single") {
            const row = data.find(r => r.material === mat && r.month === cur);
            return {
                cols: [
                    { key: "label", header: "Component", isLabel: true },
                    { key: "qty", header: "Qty" },
                    { key: "value", header: "Value" },
                    { key: "rate", header: "Rate" },
                ],
                rows: COMPS.map(c => ({
                    label: c.label,
                    qty: fmt(row?.[c.qk] ?? null),
                    value: fmt(row?.[c.vk] ?? null, { rupee: true }),
                    rate: c.rk ? fmt(row?.[c.rk] ?? null) : "—",
                })),
            };
        }
        const orderedM = viewMode === "mty-all"
            ? [avail[avail.length - 1], ...avail.slice(0, -1)]
            : avail;
        const cols: ColDef[] = [
            { key: "label", header: "Component", isLabel: true },
            ...orderedM.flatMap(m => [
                { key: `${m}_qty`, header: `${m} Qty`, monthGroup: m },
                { key: `${m}_val`, header: `${m} Value`, monthGroup: m },
            ]),
        ];
        const rows = COMPS.map(c => {
            const row: Record<string, string> = { label: c.label };
            orderedM.forEach(m => {
                const rd = data.find(r => r.material === mat && r.month === m);
                row[`${m}_qty`] = fmt(rd?.[c.qk] ?? null);
                row[`${m}_val`] = fmt(rd?.[c.vk] ?? null, { rupee: true });
            });
            return row;
        });
        return { cols, rows };
    };

    return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 min-w-0">
                    <TrendChart
                        title={`${trendOption} Trend`}
                        data={trendData}
                        dataKey="value"
                        combo
                        barKey="value"
                        lineKey="rate"
                        qtyKey="qty"
                        options={materials}
                        selectedOption={trendOption}
                        onOptionChange={setTrendOption}
                        barRupee
                        lineRupee
                    />
                </div>
                <HeroMetricsPanel
                    metrics={[
                        { title: "Total Value", value: totVal, prevValue: prevTotVal, rupee: true, deltaMode: "neutral" },
                        { title: "Total Qty", value: totQty, prevValue: prevTotQty, deltaMode: "neutral" },
                    ]}
                />
            </div>

            <DetailedBreakdown sections={materials.map(mat => {
                const rd = curData.find(r => r.material === mat);
                const prevRd = prevCurData.find(r => r.material === mat);
                const { cols, rows } = buildMatTable(mat);
                return {
                    title: mat,
                    cols,
                    rows,
                    heroes: [
                        { title: "Qty", value: rd?.qty ?? null, prevValue: prevRd?.qty ?? null, deltaMode: "neutral" as const },
                        { title: "Value", value: rd?.value ?? null, prevValue: prevRd?.value ?? null, rupee: true, deltaMode: "neutral" as const },
                        { title: "Rate", value: rd?.rate ?? null, prevValue: prevRd?.rate ?? null, deltaMode: "neutral" as const },
                    ],
                };
            })} />
        </div>
    );
}
