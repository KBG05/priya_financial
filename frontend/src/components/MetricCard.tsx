import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmt, calcDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mini SVG trend sparkline — drawn from an array of historical values */
function MiniSparkline({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;
    const W = 52, H = 18;
    const pts = values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - min) / range) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const last = values[values.length - 1];
    const up = last >= values[0];
    const color = up ? "hsl(174 50% 50%)" : "hsl(0 60% 50%)";
    const dotY = (H - ((last - min) / range) * H).toFixed(1);
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80 mt-0.5">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={W} cy={dotY} r="2.5" fill={color} />
        </svg>
    );
}

interface MetricCardProps {
    title: string;
    value: number | null;
    prevValue?: number | null;
    rupee?: boolean;
    pct?: boolean;
    /** 'default'=green↑red↓, 'neutral'=muted always, 'inverse'=green↓red↑ */
    deltaMode?: "default" | "neutral" | "inverse";
    /** compact variant for inside collapsibles */
    compact?: boolean;
    /** historical series for mini sparkline — shows trend line when ≥2 values */
    history?: number[];
    className?: string;
}

export function MetricCard({
    title, value, prevValue, rupee, pct,
    deltaMode = "default", compact, history, className
}: MetricCardProps) {
    const formatted = fmt(value, { rupee, pct });
    const isNeg = (value ?? 0) < 0;
    const delta = prevValue != null && value != null ? calcDelta(value, prevValue) : null;

    const getDeltaColor = () => {
        if (deltaMode === "neutral") return "text-muted-foreground";
        if (delta == null) return "";
        if (deltaMode === "inverse") return delta <= 0 ? "text-emerald-500" : "text-red-500";
        return delta >= 0 ? "text-emerald-500" : "text-red-500";
    };

    const DeltaIcon = delta == null ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

    // KPI-style: left border accent based on value sign (when history present)
    const hasHistory = history && history.length >= 2;
    const borderAccent = hasHistory
        ? (value == null ? "border-l-4 border-border/40"
            : value >= 0 ? "border-l-4 border-primary/60"
                : "border-l-4 border-destructive/60")
        : "";

    return (
        <div className={cn(
            "rounded-lg bg-card flex flex-col gap-1 card-elevated min-w-0 overflow-hidden",
            compact ? "p-3" : "p-4",
            borderAccent,
            className
        )}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate w-full">{title}</p>
            <p className={cn(
                "font-bold tabnum truncate w-full",
                compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
                isNeg ? "text-red-500"
                    : hasHistory && (value ?? 0) >= 0 ? "text-primary"
                        : "text-foreground"
            )}>
                {formatted}
            </p>
            {delta != null && DeltaIcon && (
                <div className={cn("flex items-center gap-1 text-[11px] font-medium truncate w-full", getDeltaColor())}>
                    <DeltaIcon size={11} className="shrink-0" />
                    <span className="truncate">
                        {deltaMode === "neutral"
                            ? `vs prev ${Math.abs(delta).toFixed(1)}%`
                            : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prev`}
                    </span>
                </div>
            )}
            {hasHistory && <MiniSparkline values={history!} />}
        </div>
    );
}
