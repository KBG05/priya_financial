import { useState } from "react";
import { Verdict, Section, Delta, ChangeBar, Th, Td, Notice } from "@/components/review/parts";
import { baseOf, costMovers, type Fin } from "@/lib/review";
import { inr, pct } from "@/lib/money";
import { label, shortLabel } from "@/lib/period";
import { monthName } from "@/lib/narrative";
import type { ReviewPageProps } from "@/pages/types";

/** Plain names for the Tally category headings. */
const GROUP: Record<string, string> = {
    "Variable & Direct Expense": "Variable and direct",
    "Fixed Expense": "Fixed",
    "Other Expenses": "Other",
};
const groupName = (g: string) => GROUP[g] ?? g;

const total = (f: Fin, group?: string) =>
    f.expenses.filter(r => !group || r.category === group).reduce((s, r) => s + (r.value ?? 0), 0);

export function CostsPage({ review, compare }: ReviewPageProps) {
    const { cur } = review;
    const base = baseOf(review, compare);
    const [showAll, setShowAll] = useState(false);

    if (!cur.expenses.length) {
        return <Notice tone="neutral">No expense lines were uploaded for {label(cur.period)}.</Notice>;
    }

    const t = total(cur);
    const tb = base ? total(base) : null;
    const groups = [...new Set(cur.expenses.map(r => r.category))];
    const movers = base ? costMovers(cur, base) : cur.expenses.map(r => ({ label: r.line_item, group: r.category, cur: r.value ?? 0, prev: 0, delta: 0 })).sort((a, b) => b.cur - a.cur);
    const shown = showAll ? movers : movers.slice(0, 10);
    const scale = Math.max(...movers.map(m => Math.abs(m.delta)), 1);
    const risers = movers.filter(m => m.delta > 0);
    const top = risers[0];
    const dTotal = tb != null ? t - tb : null;
    const share = (v: number) => (cur.sales ? pct((v / cur.sales) * 100) : "—");

    let verdict: React.ReactNode = <>{monthName(cur)} expenses were {inr(t)}, {share(t)} of sales.</>;
    if (base && dTotal != null) {
        const pctOfRise = top && dTotal > 0 ? Math.round((top.delta / dTotal) * 100) : null;
        verdict = (
            <>
                {monthName(cur)} expenses were {inr(t)}, {share(t)} of sales,{" "}
                <span className={dTotal > 0 ? "text-destructive" : undefined}>{inr(Math.abs(dTotal))} {dTotal > 0 ? "more" : "less"}</span> than {label(base.period)}.
                {top && pctOfRise != null && pctOfRise > 0 && (
                    <span className="text-muted-foreground font-semibold"> {top.label} alone accounts for {Math.min(pctOfRise, 100)}% of the rise.</span>
                )}
            </>
        );
    }

    return (
        <>
            <Verdict
                figures={[
                    { label: "Total expenses", value: inr(t), note: base && dTotal != null && <Delta value={dTotal} goodWhen="down" text={`${inr(dTotal, { signed: true })} vs ${base.period.month}`} /> },
                    ...groups.slice(0, 2).map(g => ({
                        label: groupName(g),
                        value: inr(total(cur, g)),
                        note: base && <Delta value={total(cur, g) - total(base, g)} goodWhen="down" text={`${inr(total(cur, g) - total(base, g), { signed: true })} vs ${base.period.month}`} />,
                    })),
                    { label: "Expenses as share of sales", value: share(t), note: base && base.sales ? `${pct((total(base) / base.sales) * 100)} in ${base.period.month}` : undefined },
                ]}
            >
                {verdict}
            </Verdict>

            <Section
                finding={top && base ? `${top.label} rose most: up ${inr(top.delta)} to ${inr(top.cur)}` : `Expense lines, ${label(cur.period)}`}
                note={base ? `Every expense line, ranked by how much it changed against ${label(base.period)}. Red bars cost more, teal bars cost less.` : "Ranked by amount."}
            >
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[760px]">
                        <thead><tr>
                            <Th>Expense</Th><Th>Group</Th><Th right>{shortLabel(cur.period)}</Th>
                            {base && <Th right>{shortLabel(base.period)}</Th>}
                            {base && <Th right>Change</Th>}
                            {base && <Th className="w-[140px]"><span className="sr-only">Change, drawn to scale</span></Th>}
                            <Th right>Share of sales</Th>
                        </tr></thead>
                        <tbody className="animate-settle">
                            {shown.map(m => (
                                <tr key={`${m.group}|${m.label}`}>
                                    <th scope="row" className="text-left px-2.5 py-2.5 border-b border-border font-semibold">{m.label}</th>
                                    <Td className="text-muted-foreground whitespace-nowrap">{groupName(m.group)}</Td>
                                    <Td right strong>{inr(m.cur)}</Td>
                                    {base && <Td right>{inr(m.prev)}</Td>}
                                    {base && <Td right><Delta value={m.delta} goodWhen="down" text={inr(m.delta, { signed: true })} /></Td>}
                                    {base && <Td><ChangeBar value={m.delta} scale={scale} /></Td>}
                                    <Td right className="text-muted-foreground">{share(m.cur)}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {movers.length > 10 && (
                    <button type="button" onClick={() => setShowAll(s => !s)} aria-expanded={showAll} className="mt-3 rounded-lg px-2.5 py-1.5 text-[13px] font-bold text-primary hover:bg-primary-soft transition-colors">
                        {showAll ? "Show the 10 biggest changes" : `Show all ${movers.length} expense lines`}
                    </button>
                )}
            </Section>

            <Section
                finding={`Variable and direct costs are ${pct((total(cur, groups.find(g => g.startsWith("Variable")) ?? "") / (t || 1)) * 100)} of all expenses`}
                note="Variable costs should move with production; fixed costs should not."
            >
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[560px]">
                        <thead><tr>
                            <Th>Group</Th><Th right>{shortLabel(cur.period)}</Th>{base && <Th right>{shortLabel(base.period)}</Th>}{base && <Th right>Change</Th>}<Th right>Share of sales</Th>
                        </tr></thead>
                        <tbody>
                            {groups.map(g => (
                                <tr key={g}>
                                    <th scope="row" className="text-left px-2.5 py-2.5 border-b border-border font-semibold">{groupName(g)}</th>
                                    <Td right strong>{inr(total(cur, g))}</Td>
                                    {base && <Td right>{inr(total(base, g))}</Td>}
                                    {base && <Td right><Delta value={total(cur, g) - total(base, g)} goodWhen="down" text={inr(total(cur, g) - total(base, g), { signed: true })} /></Td>}
                                    <Td right className="text-muted-foreground">{share(total(cur, g))}</Td>
                                </tr>
                            ))}
                            <tr>
                                <th scope="row" className="text-left px-2.5 py-2.5 font-bold">All expenses</th>
                                <Td right strong className="border-0">{inr(t)}</Td>
                                {base && <Td right className="border-0">{inr(tb)}</Td>}
                                {base && <Td right className="border-0"><Delta value={dTotal} goodWhen="down" text={inr(dTotal, { signed: true })} /></Td>}
                                <Td right className="border-0 text-muted-foreground">{share(t)}</Td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Section>
        </>
    );
}
