import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, AlertTriangle, RotateCcw, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Standing, Tone } from "@/lib/review";

// ── Page verdict: the one sentence the page argues, plus its key figures ──

export interface Figure {
    label: string;
    value: ReactNode;
    note?: ReactNode;
}

export function Verdict({ children, figures }: { children: ReactNode; figures?: Figure[] }) {
    return (
        <div className="animate-settle">
            <h2 className="text-[26px] md:text-[32px] leading-[1.2] font-bold tracking-[-0.02em] max-w-[64rem] text-balance">
                {children}
            </h2>
            {figures && figures.length > 0 && (
                <dl className="mt-5 grid grid-cols-2 lg:grid-cols-4 border-y border-border">
                    {figures.map((f, i) => (
                        <div
                            key={f.label}
                            className={cn(
                                "py-3.5 pr-4 min-w-0",
                                i > 0 && "lg:pl-5 lg:border-l border-border",
                                i % 2 === 1 && "pl-4 border-l lg:pl-5",
                                i >= 2 && "border-t lg:border-t-0",
                            )}
                        >
                            <dt className="text-[13px] text-muted-foreground">{f.label}</dt>
                            <dd className="mt-0.5 text-[22px] font-bold tracking-[-0.01em] tabnum leading-tight">{f.value}</dd>
                            {f.note && <dd className="mt-1 text-[13px] text-muted-foreground">{f.note}</dd>}
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}

// ── A section led by the finding it proves ──

export function Section({
    finding, note, action, children, className, id,
}: {
    finding: ReactNode;
    note?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    id?: string;
}) {
    return (
        <section id={id} className={cn("bg-card border border-border rounded-xl p-5 md:p-6 min-w-0", className)}>
            <div className="flex flex-wrap items-start gap-x-4 gap-y-1 mb-4">
                <div className="min-w-0 flex-1 basis-[18rem]">
                    <h3 className="text-[19px] md:text-[20px] font-bold tracking-[-0.01em] leading-snug text-balance">{finding}</h3>
                    {note && <p className="mt-1 text-muted-foreground text-pretty">{note}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

// ── Tone vocabulary: status words always ride with colour ──

const TONE_TEXT: Record<Tone, string> = {
    good: "text-primary",
    bad: "text-destructive",
    neutral: "text-foreground",
};

const TAG: Record<"good" | "bad" | "watch" | "neutral", string> = {
    good: "bg-primary-soft text-primary",
    bad: "bg-destructive-soft text-destructive",
    watch: "bg-warning-soft text-warning",
    neutral: "bg-muted text-muted-foreground",
};

export function Tag({ tone, children }: { tone: keyof typeof TAG; children: ReactNode }) {
    return (
        <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[12.5px] font-bold whitespace-nowrap", TAG[tone])}>
            {children}
        </span>
    );
}

/** A standing becomes a tag: outer quarters are "watch", the 12-month extremes are "bad" or "good". */
export function StandingTag({ standing }: { standing: Standing | null }) {
    if (!standing) return <Tag tone="neutral">Too little history</Tag>;
    const extreme = standing.position === "lowest" || standing.position === "highest";
    const tone = standing.tone === "neutral" ? "neutral" : standing.tone === "good" ? "good" : extreme ? "bad" : "watch";
    return <Tag tone={tone}>{standing.words}</Tag>;
}

/** Signed change with direction arrow; colour follows whether the change helps the business. */
export function Delta({ value, text, goodWhen = "up", className }: {
    value: number | null;
    text: string;
    goodWhen?: "up" | "down" | "none";
    className?: string;
}) {
    if (value == null || !isFinite(value) || value === 0) return <span className={cn("text-muted-foreground", className)}>{value === 0 ? "No change" : "—"}</span>;
    const up = value > 0;
    const tone: Tone = goodWhen === "none" ? "neutral" : (up === (goodWhen === "up")) ? "good" : "bad";
    const Icon = up ? ArrowUpRight : ArrowDownRight;
    return (
        <span className={cn("inline-flex items-center gap-0.5 font-semibold tabnum whitespace-nowrap", TONE_TEXT[tone], className)}>
            <Icon size={14} aria-hidden className="shrink-0" />
            {text}
        </span>
    );
}

// ── Where a value sits among past months ──

/** Thin track = full past range; thick band = usual range (middle half); mark = now. */
export function RangeBar({ value, min, max, low, high, label }: { value: number; min: number; max: number; low: number; high: number; label: string }) {
    const lo = Math.min(min, value);
    const hi = Math.max(max, value);
    const span = hi - lo || 1;
    const at = (v: number) => `${((v - lo) / span) * 100}%`;
    return (
        <div className="relative h-4 w-full min-w-[96px]" role="img" aria-label={label}>
            <div className="absolute top-[7px] h-0.5 rounded-full bg-border" style={{ left: at(min), right: `calc(100% - ${at(max)})` }} />
            <div className="absolute top-[5px] h-1.5 rounded-full bg-muted-foreground/35" style={{ left: at(low), right: `calc(100% - ${at(high)})` }} />
            <div className="absolute top-0 h-4 w-[3px] -ml-[1.5px] rounded-sm bg-foreground" style={{ left: at(value) }} />
        </div>
    );
}

// ── Zero-centred change bar for mover tables ──

export function ChangeBar({ value, scale, goodWhen = "down" }: { value: number; scale: number; goodWhen?: "up" | "down" }) {
    const w = scale ? Math.min(Math.abs(value) / scale, 1) * 50 : 0;
    const good = value > 0 === (goodWhen === "up");
    return (
        <div className="relative h-3 w-full min-w-[80px]" aria-hidden>
            <div className="absolute left-1/2 -top-0.5 -bottom-0.5 border-l border-muted-foreground/60" />
            <div
                className={cn("absolute top-0.5 h-2 rounded-sm", good ? "bg-primary" : "bg-destructive")}
                style={value >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
            />
        </div>
    );
}

// ── States ──

export function Notice({ tone = "watch", children, action }: { tone?: "watch" | "neutral"; children: ReactNode; action?: ReactNode }) {
    return (
        <div className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 font-semibold",
            tone === "watch" ? "bg-warning-soft text-warning border-warning/25" : "bg-muted text-muted-foreground border-border",
        )}>
            <AlertTriangle size={16} aria-hidden className="shrink-0" />
            <div className="flex-1 min-w-0 basis-[14rem]">{children}</div>
            {action}
        </div>
    );
}

export function UploadButton({ children = "Upload files" }: { children?: ReactNode }) {
    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("pf:open-upload"))}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3.5 py-1.5 text-[13px] font-bold hover:bg-primary/90 transition-colors"
        >
            <UploadCloud size={15} aria-hidden /> {children}
        </button>
    );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div role="alert" className="bg-card border border-border rounded-xl p-8 max-w-xl">
            <h2 className="text-xl font-bold">The figures could not be loaded</h2>
            <p className="mt-2 text-muted-foreground">
                The data server did not answer. Check that the backend is running on port 8080, then try again.
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground font-mono break-all">{message}</p>
            <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-input px-3.5 py-2 font-bold hover:bg-accent transition-colors">
                <RotateCcw size={15} aria-hidden /> Try again
            </button>
        </div>
    );
}

export function PageSkeleton() {
    const bar = "rounded-md bg-muted animate-pulse";
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading the month's figures">
            <div className={cn(bar, "h-9 w-3/4")} />
            <div className={cn(bar, "h-20 w-full")} />
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
                <div className={cn(bar, "h-72")} />
                <div className={cn(bar, "h-72")} />
            </div>
        </div>
    );
}

export function EmptyMonth({ month }: { month: string }) {
    return (
        <div className="bg-card border border-border rounded-xl p-8 max-w-xl">
            <h2 className="text-xl font-bold">No figures for {month} yet</h2>
            <p className="mt-2 text-muted-foreground">
                The MIS files for this month have not been uploaded. Upload the month's Tally export, or pick an earlier month from the period menu.
            </p>
            <div className="mt-5"><UploadButton>Upload {month}</UploadButton></div>
        </div>
    );
}

// ── Plain tables ──

export function Th({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) {
    return (
        <th scope="col" className={cn("px-2.5 py-2 text-[12.5px] font-semibold text-muted-foreground border-b border-border whitespace-nowrap", right ? "text-right" : "text-left", className)}>
            {children}
        </th>
    );
}

export function Td({ children, right, className, strong }: { children?: ReactNode; right?: boolean; className?: string; strong?: boolean }) {
    return (
        <td className={cn("px-2.5 py-2.5 border-b border-border", right && "text-right tabnum", strong && "font-bold", className)}>
            {children}
        </td>
    );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-primary hover:bg-primary-soft transition-colors whitespace-nowrap">
            {children} <ArrowRight size={14} aria-hidden />
        </button>
    );
}
