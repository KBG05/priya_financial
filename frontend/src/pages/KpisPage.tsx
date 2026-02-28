import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerTable } from "@/components/LedgerTable";
import type { ColDef } from "@/components/LedgerTable";
import { api } from "@/api";
import { fmtKpi } from "@/lib/format";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";
import { cn } from "@/lib/utils";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

/** Simple SVG sparkline from a data series */
function Sparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 64, h = 24;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x},${y}`;
    }).join(" ");
    const last = values[values.length - 1];
    const trend = last >= values[0];
    return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-1">
            <polyline
                points={pts}
                fill="none"
                stroke={trend ? "hsl(174 50% 50%)" : "hsl(0 60% 50%)"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <circle
                cx={w} cy={h - ((last - min) / range) * h}
                r="2.5"
                fill={trend ? "hsl(174 50% 50%)" : "hsl(0 60% 50%)"}
            />
        </svg>
    );
}

export function KpisPage({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [prevData, setPrevData] = useState<any[]>([]);
    const [allData, setAllData] = useState<any[]>([]); // for sparklines
    const [loading, setLoading] = useState(true);
    const cur = months[months.length - 1];
    const prev = prevMonths[prevMonths.length - 1];

    useEffect(() => {
        setLoading(true);
        // Fetch all available months for sparkline context
        const sparkMonths = MONTH_ORDER.slice(
            0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1)
        ).join(",");
        Promise.all([
            api.kpis(months),
            prevMonths.length ? api.kpis(prevMonths) : Promise.resolve({ data: [] }),
            api.kpis(sparkMonths.split(",").filter(Boolean)),
        ]).then(([r, p, all]) => {
            setData(r.data); setPrevData(p.data); setAllData(all.data); setLoading(false);
        });
    }, [months.join(","), prevMonths.join(",")]);

    if (loading) return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-64" />
        </div>
    );

    const kpis = [...new Set(data.map((r: any) => r.kpi_name))];
    const kv = (name: string): number | null => data.find((r: any) => r.kpi_name === name && r.month === cur)?.value ?? null;
    const pv = (name: string): number | null => prevData.find((r: any) => r.kpi_name === name && r.month === prev)?.value ?? null;

    /** Series of values for sparkline across all months for a KPI */
    const sparkSeries = (name: string): number[] => {
        return MONTH_ORDER
            .map(m => allData.find((r: any) => r.kpi_name === name && r.month === m)?.value ?? null)
            .filter((v): v is number => v != null);
    };

    const HIGHLIGHT_KPIS = ["Revenue growth", "Gross margin", "EBITDA", "Net Margin"];

    let cols: ColDef[];
    let rows: Record<string, string>[];

    if (viewMode === "single") {
        cols = [{ key: "kpi_name", header: "KPI", isLabel: true }, { key: "value", header: cur }];
        rows = kpis.map(k => ({ kpi_name: String(k), value: fmtKpi(String(k), kv(String(k))) }));
    } else if (viewMode === "comparison") {
        cols = [
            { key: "kpi_name", header: "KPI", isLabel: true },
            { key: "cur_month", header: cur, monthGroup: "cur" },
            { key: "ytd", header: `YTD (Apr–${cur})`, isYtd: true },
        ];
        rows = kpis.map(k => {
            const curVal = kv(String(k));
            // KPIs don't sum for YTD — just show latest available value
            const ytdVal = allData.find((r: any) => r.kpi_name === k && r.month === cur)?.value ?? null;
            return { kpi_name: String(k), cur_month: fmtKpi(String(k), curVal), ytd: fmtKpi(String(k), ytdVal) };
        });
    } else {
        cols = [
            { key: "kpi_name", header: "KPI", isLabel: true },
            ...months.map(m => ({ key: m, header: m, monthGroup: m })),
        ];
        rows = kpis.map(k => {
            const row: Record<string, string> = { kpi_name: String(k) };
            months.forEach(m => {
                const r = data.find((x: any) => x.kpi_name === k && x.month === m);
                row[m] = fmtKpi(String(k), r?.value ?? null);
            });
            return row;
        });
    }

    return (
        <div className="flex flex-col gap-4">
            {/* 4 sparkline KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {HIGHLIGHT_KPIS.map(name => {
                    const v = kv(name);
                    const p = pv(name);
                    const series = sparkSeries(name);
                    return (
                        <div key={name} className={cn(
                            "rounded-xl bg-card card-elevated p-4 flex flex-col gap-1",
                            "border-l-4",
                            v == null ? "border-border/30"
                                : v >= 0 ? "border-primary/60" : "border-destructive/60"
                        )}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{name}</p>
                            <p className={cn(
                                "text-2xl font-bold tabnum",
                                v == null ? "text-muted-foreground"
                                    : v >= 0 ? "text-primary" : "text-destructive"
                            )}>
                                {fmtKpi(name, v)}
                            </p>
                            {p != null && v != null && (
                                <p className="text-[11px] text-muted-foreground">
                                    <span className={v >= p ? "text-primary" : "text-destructive"}>
                                        {v >= p ? "▲" : "▼"} {Math.abs(((v - p) / Math.abs(p || 1)) * 100).toFixed(1)}%
                                    </span>{" "}vs prev
                                </p>
                            )}
                            <Sparkline values={series} />
                        </div>
                    );
                })}
            </div>

            {/* Full KPI table */}
            <div className="rounded-xl bg-card card-elevated overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border/25">
                    <p className="text-sm font-semibold">All KPIs</p>
                </div>
                <div className="p-3">
                    <LedgerTable cols={cols} rows={rows} />
                </div>
            </div>
        </div>
    );
}
