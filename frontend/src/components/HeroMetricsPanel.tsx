import { useState } from "react";
import { LayoutGrid, List, BarChart2, Wallet, Percent, Activity, TrendingUp, Clock, DollarSign, Package } from "lucide-react";
import { MetricCard } from "@/components/MetricCard";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MetricItem {
    title: string;
    value: number | null;
    prevValue?: number | null;
    history?: number[];
    rupee?: boolean;
    pct?: boolean;
    deltaMode?: "default" | "neutral" | "inverse";
}

interface Props {
    metrics: MetricItem[];
}

type ViewMode = "cards" | "list";

/** Derive a simple icon from the metric title */
function getIcon(title: string) {
    const t = title.toLowerCase();
    if (t.includes("profit") || t.includes("ebitda")) return BarChart2;
    if (t.includes("sale") || t.includes("revenue")) return TrendingUp;
    if (t.includes("cost") || t.includes("expens") || t.includes("variable") || t.includes("fixed")) return Wallet;
    if (t.includes("margin") || t.includes("%") || t.includes("ratio") || t.includes("growth")) return Percent;
    if (t.includes("stock") || t.includes("purchase") || t.includes("consump")) return Package;
    if (t.includes("activity") || t.includes("ebit") || t.includes("pal")) return Activity;
    if (t.includes("time") || t.includes("day")) return Clock;
    return DollarSign;
}

/** Build an SVG polyline path from a history array, normalised to (w × h) viewBox */
function sparkPath(history: number[], w = 72, h = 24): string {
    if (!history || history.length < 2) return "";
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    const pts = history.map((v, i) => {
        const x = (i / (history.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(" ");
}

/** Inline sparkline SVG */
function Sparkline({ history, positive }: { history: number[]; positive: boolean }) {
    if (!history || history.length < 2) return <span className="w-18" />;
    const pts = sparkPath(history);
    return (
        <svg width={72} height={24} viewBox={`0 0 72 24`} className="shrink-0">
            <polyline
                points={pts}
                fill="none"
                stroke={positive ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function HeroMetricsPanel({ metrics }: Props) {
    const [view, setView] = useState<ViewMode>("cards");

    return (
        <div className="flex flex-col gap-2 w-full xl:w-[30%] shrink-0 self-stretch">
            {/* Toggle */}
            <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-lg w-fit border border-border/30 self-start">
                <button
                    onClick={() => setView("cards")}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150",
                        view === "cards" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <LayoutGrid size={12} />
                    Cards
                </button>
                <button
                    onClick={() => setView("list")}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150",
                        view === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <List size={12} />
                    List
                </button>
            </div>

            {view === "cards" ? (
                /* ── Card View (existing) ── */
                <div className="flex flex-col gap-3">
                    {metrics.map(m => (
                        <MetricCard
                            key={m.title}
                            title={m.title}
                            value={m.value}
                            prevValue={m.prevValue}
                            history={m.history}
                            rupee={m.rupee}
                            pct={m.pct}
                            deltaMode={m.deltaMode}
                            compact
                        />
                    ))}
                </div>
            ) : (
                /* ── List View ── */
                <div
                    className="rounded-xl bg-card card-elevated overflow-hidden flex flex-col flex-1 min-h-0"
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-border/30 shrink-0">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Key Metrics</p>
                    </div>
                    {/* Rows */}
                    <div className="flex flex-col divide-y divide-border/20 flex-1 min-h-0 overflow-y-auto">
                        {metrics.map(m => {
                            const Icon = getIcon(m.title);
                            const isPositive =
                                m.deltaMode === "neutral"
                                    ? true
                                    : m.deltaMode === "inverse"
                                        ? (m.value ?? 0) < (m.prevValue ?? 0)
                                        : (m.value ?? 0) >= (m.prevValue ?? 0);

                            const formatted = fmt(m.value, { rupee: m.rupee, pct: m.pct });

                            return (
                                <div key={m.title} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/10 transition-colors">
                                    {/* Icon */}
                                    <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted/30 shrink-0">
                                        <Icon size={13} className="text-muted-foreground" />
                                    </div>
                                    {/* Label + Value */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[11px] text-muted-foreground leading-tight truncate">{m.title}</p>
                                        <p className={cn(
                                            "text-xs font-semibold tabnum leading-tight",
                                            m.deltaMode !== "neutral" && (isPositive ? "text-foreground" : "text-destructive")
                                        )}>
                                            {formatted ?? "—"}
                                        </p>
                                    </div>
                                    {/* Sparkline */}
                                    <Sparkline history={m.history ?? []} positive={isPositive} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
