import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { MetricCard } from "@/components/MetricCard";
import { LedgerTable } from "@/components/LedgerTable";
import type { ColDef } from "@/components/LedgerTable";
import { Progress } from "@/components/ui/progress";
import { api } from "@/api";
import { fmt } from "@/lib/format";
import type { ViewMode } from "@/types";
import { cn } from "@/lib/utils";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }
interface MatRow { month: string; material: string;[k: string]: any; }

export function ConsumptionPage({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<MatRow[]>([]);
    const [prevData, setPrevData] = useState<MatRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.consumption(months),
            prevMonths.length ? api.consumption(prevMonths) : Promise.resolve({ data: [] }),
        ]).then(([r, p]) => { setData(r.data as MatRow[]); setPrevData(p.data as MatRow[]); setLoading(false); });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
    );

    const curData = data.filter(r => r.month === cur);
    const prevCurData = prevData.filter(r => r.month === prev);
    const totVal = curData.reduce((s, r) => s + (r.value ?? 0), 0);
    const totQty = curData.reduce((s, r) => s + (r.qty ?? 0), 0);
    const prevTotVal = prevCurData.reduce((s, r) => s + (r.value ?? 0), 0);
    const prevTotQty = prevCurData.reduce((s, r) => s + (r.qty ?? 0), 0);
    const materials = [...new Set(data.map(r => r.material))];

    const COMPS = [
        { label: "Opening Stock", qk: "opening_stock_qty", vk: "opening_stock_value" },
        { label: "Purchases", qk: "purchases_qty", vk: "purchases_value" },
        { label: "Sales", qk: "sales_qty", vk: "sales_value" },
        { label: "Closing Stock", qk: "closing_stock_qty", vk: "closing_stock_value" },
        { label: "Consumption", qk: "qty", vk: "value", rk: "rate" },
    ];

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
        <div className="flex flex-col gap-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <MetricCard title="Total Consumption Value" value={totVal} prevValue={prevTotVal} rupee deltaMode="neutral" />
                <MetricCard title="Total Quantity" value={totQty} prevValue={prevTotQty} deltaMode="neutral" />
            </div>

            {/* Per-material collapsibles */}
            <div className="flex flex-col gap-2">
                {materials.map(mat => {
                    const rd = curData.find(r => r.material === mat);
                    const prevRd = prevCurData.find(r => r.material === mat);
                    const val = rd?.value ?? 0;
                    const qty = rd?.qty ?? 0;
                    const rate = rd?.rate ?? null;
                    const opStock = rd?.opening_stock_value ?? 0;
                    const clStock = rd?.closing_stock_value ?? 0;
                    const isOpen = open[mat] ?? false;
                    const { cols, rows } = buildMatTable(mat);

                    // Progress: Closing / Opening stock ratio (amber), cap at 100%
                    const stockPct = opStock > 0 ? Math.min((clStock / opStock) * 100, 100) : 0;

                    return (
                        <Collapsible
                            key={mat}
                            open={isOpen}
                            onOpenChange={v => setOpen(p => ({ ...p, [mat]: v }))}
                            className="rounded-xl bg-card card-elevated overflow-hidden"
                        >
                            <CollapsibleTrigger className={cn(
                                "flex w-full items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer select-none",
                                isOpen && "border-b border-border/25"
                            )}>
                                <span className="font-semibold text-sm">{mat}</span>
                                <div className="flex items-center gap-4">
                                    {/* Stock progress bar (amber) */}
                                    <div className="hidden sm:flex flex-col items-end gap-0.5 w-28">
                                        <span className="text-[10px] text-muted-foreground">Stock retention</span>
                                        <Progress value={stockPct} className="h-1.5 bg-muted [&>div]:bg-amber-400" />
                                    </div>
                                    <span className="text-sm tabnum text-muted-foreground">{fmt(val, { rupee: true })}</span>
                                    {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="collapsible-content">
                                <div className="px-4 pb-4 pt-3 flex flex-col gap-3">
                                    {/* Mini cards */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <MetricCard title="Consumed Qty" value={qty} prevValue={prevRd?.qty ?? null} deltaMode="neutral" compact />
                                        <MetricCard title="Value" value={val} prevValue={prevRd?.value ?? null} rupee deltaMode="neutral" compact />
                                        <MetricCard title="Rate" value={rate} prevValue={prevRd?.rate ?? null} deltaMode="neutral" compact />
                                    </div>
                                    {/* Stock retention progress with labels */}
                                    {opStock > 0 && (
                                        <div className="flex flex-col gap-1 px-1">
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>Opening Stock: {fmt(opStock, { rupee: true })}</span>
                                                <span>Closing: {fmt(clStock, { rupee: true })} ({stockPct.toFixed(0)}%)</span>
                                            </div>
                                            <Progress value={stockPct} className="h-2 bg-muted [&>div]:bg-amber-400" />
                                        </div>
                                    )}
                                    <div className="section-divider" />
                                    <LedgerTable cols={cols} rows={rows} />
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>
        </div>
    );
}
