import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MetricCard } from "./MetricCard";
import { LedgerTable, type ColDef } from "./LedgerTable";
import { cn } from "@/lib/utils";

export interface SectionHero {
    title: string;
    value: number | null;
    prevValue?: number | null;
    history?: number[];
    rupee?: boolean;
    pct?: boolean;
    deltaMode?: "default" | "neutral" | "inverse";
}

export type HeroMetricProps = SectionHero;

interface SectionExpanderProps {
    title: string;
    heroes?: SectionHero[];
    cols: ColDef[];
    rows: Record<string, string>[];
    defaultOpen?: boolean;
    className?: string;
    /** When true, renders without the outer card style (for use inside DetailedBreakdown) */
    nested?: boolean;
}

export function SectionExpander({
    title, heroes, cols, rows, defaultOpen = false, className, nested = false
}: SectionExpanderProps) {
    const [open, setOpen] = useState(defaultOpen);
    const n = Math.min(heroes?.length ?? 0, 3);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className={cn(
                nested
                    ? "overflow-hidden min-w-0 bg-transparent"
                    : "rounded-xl bg-card card-elevated overflow-hidden min-w-0",
                className
            )}
        >
            <CollapsibleTrigger className={cn(
                "flex w-full items-center justify-between px-5 py-3.5 select-none cursor-pointer",
                "hover:bg-muted/20 transition-colors",
                open && "border-b border-border/30"
            )}>
                <span className="font-semibold text-sm tracking-tight">{title}</span>
                {open
                    ? <ChevronUp size={14} className="text-muted-foreground" />
                    : <ChevronDown size={14} className="text-muted-foreground" />}
            </CollapsibleTrigger>

            <CollapsibleContent className="collapsible-content">
                {/* width:100% + overflow:hidden here is the hard stop — prevents any child from growing the card */}
                <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }} className="px-4 pb-4 pt-3 flex flex-col gap-3">
                    {heroes && n > 0 && (
                        <>
                            <div
                                className={cn(
                                    "grid gap-3",
                                    n === 1 ? "grid-cols-1" :
                                        n === 2 ? "grid-cols-1 md:grid-cols-2" :
                                            "grid-cols-1 md:grid-cols-3"
                                )}
                            >
                                {heroes.slice(0, n).map((h) => (
                                    <MetricCard
                                        key={h.title}
                                        title={h.title} value={h.value} prevValue={h.prevValue}
                                        history={h.history}
                                        rupee={h.rupee} pct={h.pct} deltaMode={h.deltaMode} compact
                                    />
                                ))}
                            </div>
                            <div className="section-divider" />
                        </>
                    )}
                    {/* The table scrolls within this constrained div */}
                    <div style={{ width: '100%', overflowX: 'auto' }}>
                        <LedgerTable cols={cols} rows={rows} />
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
