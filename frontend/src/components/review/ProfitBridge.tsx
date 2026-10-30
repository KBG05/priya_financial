import { cn } from "@/lib/utils";
import { lakh, roundToTotal } from "@/lib/money";
import type { Bridge } from "@/lib/review";

/**
 * Waterfall from the comparison month's net profit to this month's, drawn to
 * one scale. It is a real table, so screen readers get every step and amount.
 */
export function ProfitBridge({ bridge, fromLabel, toLabel }: { bridge: Bridge; fromLabel: string; toLabel: string }) {
    // Displayed steps are rounded so they add up to the displayed totals.
    const shown = roundToTotal(bridge.steps.map(s => s.value / 1e5), Math.round(bridge.end / 1e4) / 10 - Math.round(bridge.start / 1e4) / 10);
    const steps = bridge.steps.map((s, i) => {
        const from = bridge.start + bridge.steps.slice(0, i).reduce((sum, x) => sum + x.value, 0);
        return { ...s, from, to: from + s.value };
    });
    const points = [0, bridge.start, bridge.end, ...steps.flatMap(s => [s.from, s.to])];
    const lo = Math.min(...points);
    const hi = Math.max(...points);
    const span = hi - lo || 1;
    const pos = (v: number) => ((v - lo) / span) * 100;
    const bar = (a: number, b: number) => ({ left: `${pos(Math.min(a, b))}%`, width: `${Math.max(pos(Math.max(a, b)) - pos(Math.min(a, b)), 0.4)}%` });
    const zero = pos(0);

    const Row = ({ label, detail, a, b, value, kind }: { label: string; detail?: string; a: number; b: number; value: number; kind: "start" | "total" | "up" | "down" }) => (
        <tr className={cn((kind === "total" || kind === "start") && "font-bold")}>
            <th scope="row" className="py-2 pr-3 text-left font-semibold align-middle w-[44%] sm:w-[30%]">
                <span className="block leading-tight">{label}</span>
                {detail && <span className="block text-[12.5px] font-normal text-muted-foreground leading-snug tabnum">{detail}</span>}
            </th>
            <td className="py-2 align-middle" aria-hidden>
                <div className="relative h-6">
                    {zero > 0 && zero < 100 && <div className="absolute -top-1 -bottom-1 border-l border-dashed border-muted-foreground/50" style={{ left: `${zero}%` }} />}
                    <div
                        className={cn(
                            "bridge-bar absolute top-0 h-6 rounded-[4px]",
                            kind === "total" ? "bg-foreground" : kind === "start" ? "bg-muted-foreground/45" : kind === "up" ? "bg-primary" : "bg-destructive",
                        )}
                        style={bar(a, b)}
                    />
                </div>
            </td>
            <td className={cn(
                "py-2 pl-3 text-right tabnum align-middle whitespace-nowrap font-bold w-[1%]",
                kind === "up" && "text-primary", kind === "down" && "text-destructive",
            )}>
                {lakh(value, { signed: kind === "up" || kind === "down" })}
            </td>
        </tr>
    );

    return (
        <table className="w-full border-collapse animate-settle">
            <caption className="sr-only">Net profit bridge from {fromLabel} to {toLabel}</caption>
            <tbody>
                <Row label={`${fromLabel} net profit`} a={0} b={bridge.start} value={bridge.start / 1e5} kind="start" />
                {steps.map((s, i) => (
                    <Row key={s.id} label={s.label} detail={s.detail} a={s.from} b={s.to} value={shown[i]} kind={s.value >= 0 ? "up" : "down"} />
                ))}
                <tr><td colSpan={3} className="border-t border-border p-0" /></tr>
                <Row label={`${toLabel} net profit`} a={0} b={bridge.end} value={bridge.end / 1e5} kind="total" />
            </tbody>
        </table>
    );
}
