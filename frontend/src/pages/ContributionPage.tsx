import { useEffect, useMemo, useState, useCallback } from "react";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell,
} from "recharts";
import { ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { HeroMetricsPanel } from "@/components/HeroMetricsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/api";
import { fmt } from "@/lib/format";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";

interface ContribRow {
    month: string;
    product_id: number;
    product_name: string;
    qty: number;
    revenue: number;
    selling_price_per_kg: number;
    rm_price: number;
    filament_conversion: number;
    fabrication_per_kg: number;
    mts_per_kg: number;
    contribution_per_kg: number;
    sales_mtrs: number;
    contribution_value: number;
}

type SortKey = keyof ContribRow;
type SortDir = "asc" | "desc";
type ProfitFilter = "all" | "positive" | "negative";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

const TOP_N = 20;
const POSITIVE_COLOR = "hsl(var(--primary))";
const NEGATIVE_COLOR = "hsl(var(--destructive))";

const COLUMNS: { key: SortKey; label: string; right?: boolean; rupee?: boolean; highlight?: boolean }[] = [
    { key: "product_name",        label: "Product Name" },
    { key: "qty",                 label: "Quantity (kg)",              right: true },
    { key: "revenue",             label: "Revenue (₹)",               right: true, rupee: true },
    { key: "selling_price_per_kg",label: "Selling Price / kg",        right: true },
    { key: "rm_price",            label: "RM Price / kg",             right: true },
    { key: "filament_conversion", label: "Filament Conversion / kg",  right: true },
    { key: "fabrication_per_kg",  label: "Fabrication / kg",         right: true },
    { key: "contribution_per_kg", label: "Contribution / kg",         right: true, highlight: true },
    { key: "sales_mtrs",          label: "Sales (Metres)",            right: true },
    { key: "contribution_value",  label: "Contribution Value (₹)",    right: true, rupee: true, highlight: true },
];

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
    if (col !== sortKey) return null;
    return sortDir === "asc"
        ? <ArrowUp size={11} className="ml-1 text-primary inline" />
        : <ArrowDown size={11} className="ml-1 text-primary inline" />;
}

export function ContributionPage({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<ContribRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [profitFilter, setProfitFilter] = useState<ProfitFilter>("all");
    // Single state object so key+dir always update atomically — fixes the "sort once" bug
    const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "contribution_per_kg", dir: "desc" });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    const cur = months[months.length - 1];

    useEffect(() => {
        setLoading(true);
        const allMonths = viewMode === "single"
            ? months
            : MONTH_ORDER.slice(0, Math.max(MONTH_ORDER.indexOf(cur as any) + 1, 1));
        api.contribution(allMonths)
            .then(r => { setData(r.data as ContribRow[]); setLoading(false); })
            .catch(() => setLoading(false));
    }, [months.join(","), prevMonths.join(","), viewMode]);

    const curRows = useMemo(() => data.filter(r => r.month === cur), [data, cur]);

    // Aggregate totals (always over full curRows, not filtered)
    const totalContribValue = curRows.reduce((s, r) => s + (r.contribution_value ?? 0), 0);
    const totalRevenue      = curRows.reduce((s, r) => s + (r.revenue ?? 0), 0);
    const totalQty          = curRows.reduce((s, r) => s + (r.qty ?? 0), 0);
    const avgContribPerKg   = totalQty > 0 ? totalContribValue / totalQty : 0;
    const positiveCount     = curRows.filter(r => r.contribution_per_kg >= 0).length;
    const negativeCount     = curRows.filter(r => r.contribution_per_kg < 0).length;
    const constants         = curRows[0];

    // Chart: top N by contribution_value from full set
    const chartRows = useMemo(() =>
        [...curRows].sort((a, b) => b.contribution_value - a.contribution_value).slice(0, TOP_N),
        [curRows]
    );

    // Filtered + sorted table rows (all, for footer totals)
    const tableRows = useMemo(() => {
        let rows = curRows;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(r => r.product_name.toLowerCase().includes(q));
        }
        if (profitFilter === "positive") rows = rows.filter(r => r.contribution_per_kg >= 0);
        if (profitFilter === "negative") rows = rows.filter(r => r.contribution_per_kg < 0);
        return [...rows].sort((a, b) => {
            const av = a[sort.key] as number | string;
            const bv = b[sort.key] as number | string;
            const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
            return sort.dir === "asc" ? cmp : -cmp;
        });
    }, [curRows, search, profitFilter, sort]);

    // Pagination
    const totalPages   = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
    const safePage     = Math.min(page, totalPages);
    const pageRows     = tableRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // Totals footer (over ALL filtered rows, not just current page)
    const footerQty     = tableRows.reduce((s, r) => s + r.qty, 0);
    const footerRev     = tableRows.reduce((s, r) => s + r.revenue, 0);
    const footerContrib = tableRows.reduce((s, r) => s + r.contribution_value, 0);

    const toggleSort = useCallback((key: SortKey) => {
        setPage(1);
        setSort(prev =>
            prev.key === key
                ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
                : { key, dir: "desc" }
        );
    }, []);

    if (loading) return (
        <div className="flex flex-col gap-3 min-w-0 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
            <Skeleton className="h-72" />
            <Skeleton className="h-52" />
        </div>
    );

    if (curRows.length === 0) return (
        <div className="flex flex-col gap-4 min-w-0 w-full">
            <p className="text-sm text-muted-foreground">
                No contribution data for <strong>{cur}</strong>. Run the pipeline with{" "}
                <code>--item-sales &lt;file&gt; --months {cur}</code> to populate.
            </p>
        </div>
    );

    return (
        <div className="flex flex-col gap-3 min-w-0 w-full">
            {/* ── Hero + Chart row ── */}
            <div className="flex flex-col xl:flex-row gap-3">
                <div className="flex-1 min-w-0">
                    <Card className="card-elevated h-full">
                        <CardHeader className="py-2 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Top {Math.min(TOP_N, chartRows.length)} Products — Contribution Value
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-2 px-2 sm:px-4">
                            <div style={{ width: "100%", height: 240 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={chartRows.map(r => ({ name: r.product_name, value: r.contribution_value }))}
                                        margin={{ left: 10, right: 10, top: 4, bottom: 56 }}
                                    >
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                        <XAxis dataKey="name" tickLine={false} axisLine={false}
                                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                                            angle={-40} textAnchor="end" interval={0} />
                                        <YAxis tickLine={false} axisLine={false}
                                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                            tickFormatter={v => fmt(v, { rupee: true })} width={80} />
                                        <Tooltip
                                            formatter={(v: number) => [fmt(v, { rupee: true }), "Contribution Value"]}
                                            contentStyle={{ fontSize: 12, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                                        />
                                        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                                            {chartRows.map((r, i) => (
                                                <Cell key={i} fill={r.contribution_value >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR} fillOpacity={0.85} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <HeroMetricsPanel metrics={[
                    { title: "Total Contribution Value", value: totalContribValue, rupee: true, deltaMode: "default" },
                    { title: "Avg Contribution / kg",    value: avgContribPerKg,   rupee: true, deltaMode: "default" },
                    { title: "Total Revenue",             value: totalRevenue,      rupee: true, deltaMode: "default" },
                ]} />
            </div>

            {/* ── Constants pill row ── */}
            {constants && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground">
                        <span className="font-semibold text-foreground">RM Price:</span> ₹{constants.rm_price?.toFixed(2)}/kg
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground">
                        <span className="font-semibold text-foreground">Filament Conversion:</span> ₹{constants.filament_conversion?.toFixed(2)}/kg
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/30 text-muted-foreground">
                        {cur} · {curRows.length} products
                    </span>
                </div>
            )}

            {/* ── Product Table ── */}
            <Card className="card-elevated">
                <CardHeader className="py-2 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                            Product Contribution — {cur}
                        </CardTitle>
                        <div className="flex-1" />

                        {/* Search */}
                        <div className="relative w-48">
                            <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                                value={search}
                                onChange={e => { setPage(1); setSearch(e.target.value); }}
                                placeholder="Search product…"
                                className="h-7 pl-7 pr-6 text-xs"
                            />
                            {search && (
                                <button onClick={() => { setPage(1); setSearch(""); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                    <X size={11} />
                                </button>
                            )}
                        </div>

                        {/* Profit filter pills */}
                        <div className="flex items-center gap-1">
                            {(["all", "positive", "negative"] as ProfitFilter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => { setPage(1); setProfitFilter(f); }}
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                                        profitFilter === f
                                            ? f === "negative"
                                                ? "bg-destructive/15 border-destructive/40 text-destructive"
                                                : "bg-primary/10 border-primary/30 text-primary"
                                            : "bg-transparent border-border/40 text-muted-foreground hover:border-border hover:text-foreground"
                                    }`}
                                >
                                    {f === "all" ? `All (${curRows.length})` : f === "positive" ? `Positive (${positiveCount})` : `Negative (${negativeCount})`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Records summary bar */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>
                            Showing <span className="font-semibold text-foreground">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, tableRows.length)}</span>
                            {" "}of{" "}
                            <span className="font-semibold text-foreground">{tableRows.length}</span>
                            {tableRows.length !== curRows.length && <> (filtered from <span className="font-semibold text-foreground">{curRows.length}</span>)</>}
                        </span>
                        {(search || profitFilter !== "all") && (
                            <button onClick={() => { setPage(1); setSearch(""); setProfitFilter("all"); }}
                                className="flex items-center gap-1 text-primary hover:underline">
                                <X size={10} /> Clear filters
                            </button>
                        )}
                        <span className="ml-auto">
                            Filtered total: <span className="font-semibold text-foreground">{fmt(footerContrib, { rupee: true })}</span>
                        </span>
                    </div>
                </CardHeader>

                <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full table-auto text-xs border-collapse">
                        <thead>
                            <tr className="border-y border-border/50 bg-muted/20">
                                {COLUMNS.map((col, idx) => {
                                    const divider = idx < COLUMNS.length - 1 ? "border-r border-border/30" : "";
                                    const isActive = sort.key === col.key;
                                    return (
                                        <th
                                            key={col.key}
                                            onClick={() => toggleSort(col.key)}
                                            className={`px-2 py-1.5 font-semibold whitespace-nowrap cursor-pointer select-none transition-colors group ${col.right ? "text-right" : "text-left"} ${divider} ${isActive ? "text-foreground bg-primary/5" : "text-muted-foreground hover:text-foreground"}`}
                                        >
                                            {col.label}
                                            <SortIcon col={col.key} sortKey={sort.key} sortDir={sort.dir} />
                                            {!isActive && <ArrowUpDown size={11} className="ml-1 opacity-0 group-hover:opacity-30 inline transition-opacity" />}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {tableRows.length === 0 ? (
                                <tr>
                                    <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted-foreground">
                                        No products match the current filters.
                                    </td>
                                </tr>
                            ) : pageRows.map((r, i) => {
                                const neg = r.contribution_per_kg < 0;
                                const D = "border-r border-border/20";
                                return (
                                    <tr
                                        key={`${r.product_id}-${r.month}`}
                                        className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                                    >
                                        <td className={`px-2 py-1 text-left font-medium text-foreground whitespace-nowrap ${D}`}>
                                            {r.product_name}
                                        </td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${D}`}>{fmt(r.qty)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${D}`}>{fmt(r.revenue, { rupee: true })}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${D}`}>{fmt(r.selling_price_per_kg)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap text-muted-foreground ${D}`}>{fmt(r.rm_price)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap text-muted-foreground ${D}`}>{fmt(r.filament_conversion)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap text-muted-foreground ${D}`}>{fmt(r.fabrication_per_kg)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap font-semibold ${D} ${neg ? "text-destructive" : "text-primary"}`}>
                                            {fmt(r.contribution_per_kg)}
                                        </td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap ${D}`}>{fmt(r.sales_mtrs)}</td>
                                        <td className={`px-2 py-1 text-right tabular-nums whitespace-nowrap font-semibold ${neg ? "text-destructive" : ""}`}>
                                            {fmt(r.contribution_value, { rupee: true })}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {/* ── Totals footer ── */}
                        {pageRows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-border/60 bg-muted/30 font-semibold">
                                    <td className="px-2 py-1.5 text-left text-xs text-muted-foreground border-r border-border/30">
                                        Total ({tableRows.length})
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums border-r border-border/30">{fmt(footerQty)}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums border-r border-border/30">{fmt(footerRev, { rupee: true })}</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className="px-2 py-1.5 text-right text-muted-foreground border-r border-border/30">—</td>
                                    <td className={`px-2 py-1.5 text-right tabular-nums ${footerContrib < 0 ? "text-destructive" : "text-primary"}`}>
                                        {fmt(footerContrib, { rupee: true })}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </CardContent>

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 text-xs text-muted-foreground">
                        <span>
                            Page <span className="font-semibold text-foreground">{safePage}</span> of{" "}
                            <span className="font-semibold text-foreground">{totalPages}</span>
                            <span className="ml-2 text-muted-foreground/60">({PAGE_SIZE} per page)</span>
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(1)}
                                disabled={safePage === 1}
                                className="px-2 py-0.5 rounded border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >«</button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={safePage === 1}
                                className="px-2 py-0.5 rounded border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >‹</button>
                            {/* Page number buttons — show up to 5 around current */}
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => Math.abs(p - safePage) <= 2)
                                .map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p)}
                                        className={`w-7 py-0.5 rounded border transition-colors ${
                                            p === safePage
                                                ? "border-primary/60 bg-primary/10 text-primary font-semibold"
                                                : "border-border/40 hover:bg-muted/40"
                                        }`}
                                    >{p}</button>
                                ))
                            }
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={safePage === totalPages}
                                className="px-2 py-0.5 rounded border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >›</button>
                            <button
                                onClick={() => setPage(totalPages)}
                                disabled={safePage === totalPages}
                                className="px-2 py-0.5 rounded border border-border/40 hover:bg-muted/40 disabled:opacity-30 disabled:cursor-not-allowed"
                            >»</button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
