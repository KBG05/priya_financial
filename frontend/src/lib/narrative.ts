/**
 * narrative.ts — the plain-language findings that lead each section.
 * Every sentence is derived from figures; none are canned.
 */
import { inr, kg, pct, perKg } from "@/lib/money";
import { FULL_MONTH, label } from "@/lib/period";
import { KPI, standing, type BridgeStep, type Fin, type Review, type Standing } from "@/lib/review";

export const monthName = (f: Fin) => FULL_MONTH[f.period.month];

/** Bridge step phrased as a cause: "Production cost per kg rose ₹51.8 to ₹250.6, taking ₹57.6 L out of profit." */
export function stepSentence(step: BridgeStep, cur: Fin, base: Fin): string {
    const effect = `${step.value < 0 ? "taking" : "adding"} ${inr(Math.abs(step.value))} ${step.value < 0 ? "out of" : "to"} profit`;
    const moved = (a: number, b: number) => (b >= a ? "rose" : "fell");
    switch (step.id) {
        case "cost":
            if (cur.costPerKg != null && base.costPerKg != null)
                return `Production cost per kg ${moved(base.costPerKg, cur.costPerKg)} to ${perKg(cur.costPerKg)} (from ${perKg(base.costPerKg)}), ${effect}.`;
            break;
        case "price":
            if (cur.realisation != null && base.realisation != null)
                return `Selling price ${moved(base.realisation, cur.realisation)} to ${perKg(cur.realisation)} (from ${perKg(base.realisation)}), ${effect}.`;
            break;
        case "volume":
            if (cur.salesKg != null && base.salesKg != null)
                return `Kg sold ${moved(base.salesKg, cur.salesKg)} to ${kg(cur.salesKg)} (from ${kg(base.salesKg)}), ${effect}.`;
            break;
        case "overheads":
            return `Overheads ${moved(base.overheads, cur.overheads)} to ${inr(cur.overheads)}, ${effect}.`;
        case "finance":
            return `Finance cost ${moved(base.finance, cur.finance)} to ${inr(cur.finance)}, ${effect}.`;
    }
    return `${step.label} changed profit by ${inr(step.value, { signed: true })}.`;
}

export function largestStep(steps: BridgeStep[]): BridgeStep | null {
    return steps.reduce<BridgeStep | null>((m, s) => (!m || Math.abs(s.value) > Math.abs(m.value) ? s : m), null);
}

/** Standings for the four health signs, against the trailing 12 months. */
export function healthSigns(r: Review) {
    const hist = r.history;
    const kpiHist = (name: string) => hist.filter(f => f !== r.kpiSource).map(f => f.kpi[name] ?? null);
    const kv = (name: string) => r.kpiSource?.kpi[name] ?? null;
    return [
        {
            id: "margin", label: "Net margin", value: r.cur.netMargin, fmt: (v: number) => pct(v),
            standing: standing(r.cur.netMargin, hist.map(f => f.netMargin), true),
            asOf: r.cur, definition: "Net profit as a share of sales.",
        },
        {
            id: "ccc", label: "Cash cycle", value: kv(KPI.ccc), fmt: (v: number) => `${Math.round(v)} days`,
            standing: standing(kv(KPI.ccc), kpiHist(KPI.ccc), false),
            asOf: r.kpiSource, definition: "Days between paying for material and collecting from customers.",
        },
        {
            id: "stock", label: "Stock cover", value: r.cur.stockCover, fmt: (v: number) => `${v.toFixed(1)} months`,
            standing: standing(r.cur.stockCover, hist.map(f => f.stockCover), false),
            asOf: r.cur, definition: "Closing stock value divided by the month's sales.",
        },
        {
            id: "de", label: "Debt to equity", value: kv(KPI.debtEquity), fmt: (v: number) => v.toFixed(2),
            standing: standing(kv(KPI.debtEquity), kpiHist(KPI.debtEquity), false),
            asOf: r.kpiSource, definition: "Borrowings for every rupee of owners' funds.",
        },
    ];
}

export function isFlagged(s: Standing | null) {
    return !!s && s.tone === "bad";
}

export const asOfNote = (f: Fin | null, cur: Fin) =>
    !f ? "No balance sheet in the last 4 months" : f === cur ? null : `${label(f.period)} balance sheet`;

/** "production cost rose to ₹250.6/kg, the highest in 12 months": the clause after "because". */
export function causeClause(step: BridgeStep, cur: Fin, base: Fin, history: Fin[]): string | null {
    const moved = (a: number, b: number) => (b >= a ? "rose" : "fell");
    const extreme = (v: number | null, pick: (f: Fin) => number | null, higherIsBetter: boolean) => {
        const s = standing(v, history.map(pick), higherIsBetter);
        return s && (s.position === "lowest" || s.position === "highest") ? `, ${s.words.toLowerCase()}` : "";
    };
    switch (step.id) {
        case "cost":
            return cur.costPerKg != null && base.costPerKg != null
                ? `production cost ${moved(base.costPerKg, cur.costPerKg)} to ${perKg(cur.costPerKg)}${extreme(cur.costPerKg, f => f.costPerKg, false)}` : null;
        case "price":
            return cur.realisation != null && base.realisation != null
                ? `selling price ${moved(base.realisation, cur.realisation)} to ${perKg(cur.realisation)}${extreme(cur.realisation, f => f.realisation, true)}` : null;
        case "volume":
            return cur.salesKg != null && base.salesKg != null
                ? `kg sold ${moved(base.salesKg, cur.salesKg)} to ${kg(cur.salesKg)}` : null;
        case "overheads": return `overheads ${moved(base.overheads, cur.overheads)} to ${inr(cur.overheads)}`;
        case "finance": return `finance cost ${moved(base.finance, cur.finance)} to ${inr(cur.finance)}`;
        case "gross": return `gross profit ${moved(base.grossProfit, cur.grossProfit)} to ${inr(cur.grossProfit)}`;
    }
    return null;
}

/** One-clause claim for a set of measures, built from where each one sits. */
export function standingsClaim(rows: { label: string; standing: Standing | null }[], subject: string): string {
    const severity = (s: Standing) => (s.position === "lowest" || s.position === "highest" ? 2 : 1) + (s.tone === "bad" ? 0.5 : 0);
    const out = rows.filter(r => r.standing && r.standing.position !== "usual")
        .sort((a, b) => severity(b.standing!) - severity(a.standing!));
    if (!out.length) return `${subject} are all within their usual range`;
    const phrase = (r: typeof out[number]) => `${r.label.toLowerCase()} is ${r.standing!.words.toLowerCase()}`;
    const lead = out.slice(0, 2).map(phrase);
    const text = lead.length > 1 ? `${lead[0]}, and ${lead[1]}` : lead[0];
    const sentence = text[0].toUpperCase() + text.slice(1);
    return out.length > 2 ? `${out.length} of ${rows.length} measures are outside their usual range. ${sentence}` : sentence;
}
