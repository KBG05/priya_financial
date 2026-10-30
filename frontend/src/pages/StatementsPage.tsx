import { useEffect, useState } from "react";
import { Section, Th, Td, Delta } from "@/components/review/parts";
import { api } from "@/api";
import { baseOf } from "@/lib/review";
import { inrExact, kg, num } from "@/lib/money";
import { label, shortLabel, type Period } from "@/lib/period";
import type { ReviewPageProps } from "@/pages/types";
import { cn } from "@/lib/utils";

type Sheet = "mty" | "pal1" | "expenses";
type Line = { line_item: string; value: number | null; qty?: number | null; rate?: number | null; category?: string };

const SHEETS: { id: Sheet; label: string; note: string }[] = [
    { id: "mty", label: "MIS summary (MTY)", note: "The MTY sheet line by line. Its definitions are the ones used everywhere in this dashboard." },
    { id: "pal1", label: "PAL I", note: "The PAL I sheet with quantity and rate. Its Gross Profit is calculated differently from the MTY sheet's." },
    { id: "expenses", label: "Expense ledger", note: "Direct, fixed and other expense lines as booked in Tally." },
];

async function fetchSheet(sheet: Sheet, p: Period): Promise<Line[]> {
    const r = sheet === "mty" ? await api.mty([p.month], p.fy) : sheet === "pal1" ? await api.pal1([p.month], p.fy) : await api.directExpenses([p.month], p.fy);
    return r.data as Line[];
}

export function StatementsPage({ review, compare }: ReviewPageProps) {
    const { cur } = review;
    const base = baseOf(review, compare);
    const [sheet, setSheet] = useState<Sheet>("mty");
    const [lines, setLines] = useState<{ cur: Line[]; base: Line[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLines(null);
        setError(null);
        Promise.all([fetchSheet(sheet, cur.period), base ? fetchSheet(sheet, base.period) : Promise.resolve([])])
            .then(([c, b]) => { if (!cancelled) setLines({ cur: c, base: b }); })
            .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
        return () => { cancelled = true; };
    }, [sheet, cur.period.fy, cur.period.month, base?.period.fy, base?.period.month]);

    const keyOf = (l: Line) => `${l.category ?? ""}|${l.line_item}`;
    const baseMap = new Map((lines?.base ?? []).map(l => [keyOf(l), l]));
    const meta = SHEETS.find(s => s.id === sheet)!;
    const withQty = sheet === "pal1";

    return (
        <Section
            finding={`${meta.label}, ${label(cur.period)}`}
            note={`${meta.note} Exact rupees, exactly as uploaded.`}
            action={
                <div role="tablist" aria-label="Statement" className="flex flex-wrap items-center rounded-lg bg-muted p-0.5">
                    {SHEETS.map(s => (
                        <button
                            key={s.id}
                            role="tab"
                            type="button"
                            aria-selected={sheet === s.id}
                            onClick={() => setSheet(s.id)}
                            className={cn("px-3 py-1.5 text-[13px] font-semibold rounded-md transition-colors whitespace-nowrap", sheet === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            }
        >
            {error ? (
                <p role="alert" className="text-destructive font-semibold">This sheet could not be loaded: {error}</p>
            ) : !lines ? (
                <div className="h-96 rounded-md bg-muted animate-pulse" aria-busy="true" aria-label="Loading statement" />
            ) : (
                <div className="overflow-auto max-h-[70vh] border border-border rounded-lg animate-settle">
                    <table className="w-full border-collapse min-w-[720px]">
                        <thead className="sticky top-0 bg-card z-10"><tr>
                            <Th>Line</Th>
                            {sheet === "expenses" && <Th>Group</Th>}
                            {withQty && <Th right>Kg</Th>}
                            {withQty && <Th right>Rate</Th>}
                            <Th right>{shortLabel(cur.period)}</Th>
                            {base && <Th right>{shortLabel(base.period)}</Th>}
                            {base && <Th right>Change</Th>}
                        </tr></thead>
                        <tbody>
                            {lines.cur.map(l => {
                                const b = baseMap.get(keyOf(l));
                                const d = l.value != null && b?.value != null ? l.value - b.value : null;
                                return (
                                    <tr key={keyOf(l)} className="hover:bg-muted/60">
                                        <th scope="row" className="text-left px-2.5 py-2 border-b border-border font-semibold whitespace-nowrap">{l.line_item}</th>
                                        {sheet === "expenses" && <Td className="text-muted-foreground whitespace-nowrap">{l.category}</Td>}
                                        {withQty && <Td right className="text-muted-foreground">{l.qty ? kg(l.qty) : ""}</Td>}
                                        {withQty && <Td right className="text-muted-foreground">{l.rate ? num(l.rate) : ""}</Td>}
                                        <Td right strong className={(l.value ?? 0) < 0 ? "text-destructive" : undefined}>{inrExact(l.value)}</Td>
                                        {base && <Td right className={(b?.value ?? 0) < 0 ? "text-destructive" : undefined}>{inrExact(b?.value)}</Td>}
                                        {base && <Td right>{d == null ? "—" : <Delta value={d} goodWhen="none" text={inrExact(d)} />}</Td>}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Section>
    );
}
