import { cn } from "@/lib/utils";

export interface SeriesPoint {
    label: string;
    value: number | null;
    current?: boolean;
    /** Marks a month that distorts the series, e.g. a stock revaluation. */
    unusual?: boolean;
}

/**
 * Monthly bars on a zero baseline. Unusual months are drawn as outlines and
 * clipped to the scale of the rest so one spike cannot flatten the others.
 */
export function BarSeries({ points, format, caption, height = 180 }: {
    points: SeriesPoint[];
    format: (v: number) => string;
    caption: string;
    height?: number;
}) {
    const usual = points.filter(p => p.value != null && !p.unusual).map(p => p.value as number);
    const hi = Math.max(0, ...usual);
    const lo = Math.min(0, ...usual);
    const span = hi - lo || 1;
    const zeroPct = (hi / span) * 100;
    const clip = (v: number) => Math.max(lo, Math.min(hi, v));

    return (
        <figure className="animate-settle">
            <div className="flex items-stretch gap-1 sm:gap-1.5" style={{ height }} aria-hidden>
                {points.map(p => {
                    const v = p.value == null ? null : clip(p.value);
                    const top = v == null ? zeroPct : ((hi - Math.max(v, 0)) / span) * 100;
                    const h = v == null ? 0 : (Math.abs(v) / span) * 100;
                    const clipped = p.value != null && v !== p.value;
                    return (
                        <div key={p.label} className="relative flex-1 min-w-0 group" title={p.value == null ? `${p.label}: no data` : `${p.label}: ${format(p.value)}${p.unusual ? " (unusual month)" : ""}`}>
                            <div className="absolute inset-x-0 border-t border-muted-foreground/50" style={{ top: `${zeroPct}%` }} />
                            {v != null && (
                                <div
                                    className={cn(
                                        "absolute inset-x-[12%] rounded-[3px] transition-[top,height] duration-200",
                                        p.unusual ? "border-2 border-dashed border-muted-foreground/70 bg-transparent"
                                            : p.current ? "bg-primary" : (p.value as number) < 0 ? "bg-destructive/75" : "bg-foreground/25",
                                    )}
                                    style={{ top: `${top}%`, height: `max(${h}%, 2px)` }}
                                />
                            )}
                            {(p.current || clipped) && p.value != null && (
                                <span
                                    className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold tabnum px-1 rounded bg-card", p.current ? "text-primary" : "text-muted-foreground")}
                                    style={{ top: (p.value as number) >= 0 ? `calc(${top}% - 20px)` : `calc(${top + h}% + 2px)` }}
                                >
                                    {format(p.value)}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="flex gap-1 sm:gap-1.5 mt-2" aria-hidden>
                {points.map(p => (
                    <span key={p.label} className={cn("flex-1 min-w-0 text-center text-[12px] truncate", p.current ? "font-bold text-foreground" : "text-muted-foreground")}>
                        {p.label}
                    </span>
                ))}
            </div>
            {points.some(p => p.unusual) && (
                <figcaption className="mt-3 text-[13px] text-muted-foreground flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-sm border-2 border-dashed border-muted-foreground/70" aria-hidden />
                    Dashed: unusual month (one-off adjustment), drawn outside the scale of the others.
                </figcaption>
            )}
            <table className="sr-only">
                <caption>{caption}</caption>
                <tbody>
                    {points.map(p => (
                        <tr key={p.label}><th scope="row">{p.label}</th><td>{p.value == null ? "No data" : format(p.value)}{p.unusual ? " (unusual month)" : ""}</td></tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
}
