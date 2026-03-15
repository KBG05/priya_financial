import { useState } from "react";
import { LayoutList, PanelLeftClose } from "lucide-react";
import { SectionExpander } from "@/components/SectionExpander";
import { LedgerTable, type ColDef } from "@/components/LedgerTable";
import type { HeroMetricProps } from "@/components/SectionExpander";
import { cn } from "@/lib/utils";

export interface SectionData {
    title: string;
    cols: ColDef[];
    rows: Record<string, string>[];
    heroes?: HeroMetricProps[];
}

interface Props {
    sections: SectionData[];
}

type ViewMode = "accordion" | "panel";

export function DetailedBreakdown({ sections }: Props) {
    const [view, setView] = useState<ViewMode>("accordion");
    const [selected, setSelected] = useState(0);

    const ICONS = ["💰", "📦", "🔧", "📋", "📈", "📊", "🧾", "🔩", "📉"];

    return (
        <div className="flex flex-col gap-3 min-w-0 w-full">
            {/* View Switcher */}
            <div className="flex items-center gap-1 p-1 bg-muted/20 rounded-lg w-fit border border-border/30">
                <button
                    onClick={() => setView("accordion")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150",
                        view === "accordion"
                            ? "bg-card shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <LayoutList size={13} />
                    Accordion
                </button>
                <button
                    onClick={() => setView("panel")}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150",
                        view === "panel"
                            ? "bg-card shadow text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <PanelLeftClose size={13} />
                    Panel
                </button>
            </div>

            {view === "accordion" ? (
                /* ── Accordion View ── */
                <div className="rounded-xl border border-border/40 bg-card card-elevated overflow-hidden min-w-0">
                    {/* Container Header */}
                    <div className="px-5 py-4 border-b border-border/30">
                        <p className="font-semibold text-sm text-foreground">Detailed Breakdown</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Accordion view for detailed financials</p>
                    </div>
                    {/* Collapsibles stacked inside */}
                    <div className="flex flex-col divide-y divide-border/20">
                        {sections.map(sec => (
                            <SectionExpander
                                key={sec.title}
                                title={sec.title}
                                heroes={sec.heroes}
                                cols={sec.cols}
                                rows={sec.rows}
                                nested
                            />
                        ))}
                    </div>
                </div>
            ) : (
                /* ── Panel View ── */
                <div className="flex gap-0 rounded-xl border border-border/40 bg-card card-elevated overflow-hidden min-w-0" style={{ minHeight: 400 }}>
                    {/* Left: Category list */}
                    <div className="flex flex-col border-r border-border/30 shrink-0 w-52">
                        {sections.map((sec, i) => {
                            const icon = ICONS[i % ICONS.length];
                            const label = sec.title.replace(/^[^\w]+/, "").trim(); // strip leading emoji
                            return (
                                <button
                                    key={sec.title}
                                    onClick={() => setSelected(i)}
                                    className={cn(
                                        "flex items-center gap-2.5 px-4 py-3.5 text-left text-sm transition-colors border-l-2",
                                        i === selected
                                            ? "bg-primary/10 border-primary text-foreground font-semibold"
                                            : "border-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                                    )}
                                >
                                    <span className="text-base leading-none">{icon}</span>
                                    <span className="truncate">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* Right: Table for selected section */}
                    <div className="flex flex-col flex-1 min-w-0 p-4 gap-3">
                        <p className="font-semibold text-sm text-foreground">{sections[selected]?.title}</p>
                        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto" }}>
                            <LedgerTable cols={sections[selected]?.cols ?? []} rows={sections[selected]?.rows ?? []} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
