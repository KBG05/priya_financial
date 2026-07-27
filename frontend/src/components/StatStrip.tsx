import { fmt, calcDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface StatItem {
    title: string;
    value: number | null;
    prevValue?: number | null;
    history?: number[];
    rupee?: boolean;
    pct?: boolean;
    deltaMode?: "default" | "neutral" | "inverse";
}

interface Props {
    stats: StatItem[];
    /** Marks the first tile as the primary headline figure (larger type) */
    leadFirst?: boolean;
}

function sparkPath(history: number[], w: number, h: number): string {
    if (!history || history.length < 2) return "";
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = max - min || 1;
    return history
        .map((v, i) => {
            const x = (i / (history.length - 1)) * w;
            const y = h - ((v - min) / range) * h;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
}

function TileSpark({ history, tone }: { history?: number[]; tone: "up" | "down" | "flat" }) {
    if (!history || history.length < 2) return null;
    const W = 108, H = 32;
    const pts = sparkPath(history, W, H);
    const stroke = tone === "flat" ? "hsl(var(--muted-foreground))" : tone === "up" ? "hsl(var(--positive))" : "hsl(var(--destructive))";
    const area = `0,${H} ${pts} ${W},${H}`;
    return (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="absolute right-0 bottom-0 opacity-90 pointer-events-none" preserveAspectRatio="none">
            <polyline points={area} fill={stroke} fillOpacity={0.07} stroke="none" />
            <polyline points={pts} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
    );
}

export function StatStrip({ stats, leadFirst }: Props) {
    return (
        <div
            className="grid gap-px bg-border/70 rounded-xl overflow-hidden border border-border/70"
            style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${leadFirst ? 168 : 152}px, 1fr))` }}
        >
            {stats.map((s, i) => {
                const isNeutral = s.deltaMode === "neutral";
                const isPositive = isNeutral
                    ? true
                    : s.deltaMode === "inverse"
                        ? (s.value ?? 0) < (s.prevValue ?? 0)
                        : (s.value ?? 0) >= (s.prevValue ?? 0);
                const tone: "up" | "down" | "flat" = isNeutral ? "flat" : isPositive ? "up" : "down";
                const delta = s.prevValue != null && s.value != null ? calcDelta(s.value, s.prevValue) : null;
                const formatted = fmt(s.value, { rupee: s.rupee, pct: s.pct });
                const lead = leadFirst && i === 0;

                return (
                    <div
                        key={s.title}
                        className={cn(
                            "relative bg-card px-4 py-3.5 min-w-0 overflow-hidden flex flex-col justify-between gap-2",
                            lead && "bg-primary/[0.06]"
                        )}
                        style={{ minHeight: lead ? 104 : 92 }}
                    >
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate relative z-10">
                            {s.title}
                        </p>
                        <div className="relative z-10">
                            <p className={cn(
                                "font-display font-semibold tabnum leading-none truncate",
                                lead ? "text-[1.7rem]" : "text-xl",
                                !isNeutral && !isPositive ? "text-destructive" : lead ? "text-primary" : "text-foreground"
                            )}>
                                {formatted}
                            </p>
                            {delta != null && (
                                <p className={cn(
                                    "text-[11px] font-semibold mt-1 tabnum",
                                    isNeutral ? "text-muted-foreground" : isPositive ? "text-positive" : "text-destructive"
                                )}>
                                    {isNeutral
                                        ? `${Math.abs(delta).toFixed(1)}% vs prev`
                                        : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs prev`}
                                </p>
                            )}
                        </div>
                        <TileSpark history={s.history} tone={tone} />
                    </div>
                );
            })}
        </div>
    );
}
