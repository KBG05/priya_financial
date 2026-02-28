import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { fmt, calcDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MetricCardProps {
    title: string;
    value: number | null;
    prevValue?: number | null;
    rupee?: boolean;
    pct?: boolean;
    /** 'default'=green↑red↓, 'neutral'=muted always, 'inverse'=green↓red↑ */
    deltaMode?: "default" | "neutral" | "inverse";
    /** compact variant removes some padding */
    compact?: boolean;
    className?: string;
}

export function MetricCard({
    title, value, prevValue, rupee, pct, deltaMode = "default", compact, className
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

    return (
        <div className={cn(
            "rounded-lg border border-border/50 bg-card flex flex-col gap-1",
            compact ? "p-3" : "p-4 shadow-sm",
            className
        )}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate">{title}</p>
            <p className={cn("font-bold tabular-nums", compact ? "text-xl" : "text-2xl", isNeg ? "text-red-500" : "text-foreground")}>
                {formatted}
            </p>
            {delta != null && DeltaIcon && (
                <div className={cn("flex items-center gap-1 text-[11px] font-medium", getDeltaColor())}>
                    <DeltaIcon size={11} />
                    <span>
                        {deltaMode === "neutral"
                            ? `vs prev ${Math.abs(delta).toFixed(1)}%`
                            : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prev`}
                    </span>
                </div>
            )}
        </div>
    );
}
