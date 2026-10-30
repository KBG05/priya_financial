import { Verdict, Section, Delta, StandingTag, Th, Td, Notice } from "@/components/review/parts";
import { BarSeries } from "@/components/review/BarSeries";
import { unusualMonths } from "@/lib/series";
import { baseOf, standing, type Fin } from "@/lib/review";
import { change, inr, kg, pct, perKg, pts } from "@/lib/money";
import { label, shortLabel } from "@/lib/period";
import { monthName } from "@/lib/narrative";
import type { ReviewPageProps } from "@/pages/types";

export function ProfitPage({ review, compare }: ReviewPageProps) {
    const { cur, history } = review;
    const base = baseOf(review, compare);
    const other = compare === "ly" ? review.prev : review.lastYear;
    const avg = (f: (x: Fin) => number | null) => {
        const v = history.map(f).filter((x): x is number => x != null);
        return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    const costSt = standing(cur.costPerKg, history.map(f => f.costPerKg), false);
    const dCost = base && cur.costPerKg != null && base.costPerKg != null ? cur.costPerKg - base.costPerKg : null;
    const dPrice = base && cur.realisation != null && base.realisation != null ? cur.realisation - base.realisation : null;

    // ── Verdict: which per-kg lever moved the margin ──
    let verdict: React.ReactNode = <>Net margin was {pct(cur.netMargin)} in {monthName(cur)}.</>;
    if (base && dCost != null && dPrice != null) {
        const costLed = Math.abs(dCost) >= Math.abs(dPrice);
        const costWords = <>production cost per kg {dCost >= 0 ? "rose" : "fell"} {perKg(Math.abs(dCost))} to {perKg(cur.costPerKg)}</>;
        const priceWords = <>selling price {dPrice >= 0 ? "rose" : "fell"} {perKg(Math.abs(dPrice))}</>;
        verdict = costLed
            ? <>Margin moved on cost, not price: {costWords}{costSt && costSt.position !== "usual" ? <>, <span className={costSt.tone === "bad" ? "text-destructive" : undefined}>{costSt.words.toLowerCase()}</span></> : null}, while {priceWords}.</>
            : <>Margin moved on price: {priceWords} to {perKg(cur.realisation)}, while {costWords}.</>;
    }

    // ── Net margin series ──
    const series = review.series;
    const flags = unusualMonths(series.map(f => f.netMargin));
    const marginSt = standing(cur.netMargin, history.map(f => f.netMargin), true);

    const perKgRows = [
        { label: "Selling price", get: (f: Fin) => f.realisation, fmt: perKg, goodWhen: "up" as const },
        { label: "Production cost", get: (f: Fin) => f.costPerKg, fmt: perKg, goodWhen: "down" as const, note: "Sales minus gross profit, per kg sold" },
        { label: "Gross profit", get: (f: Fin) => (f.salesKg ? f.grossProfit / f.salesKg : null), fmt: perKg, goodWhen: "up" as const },
        { label: "Raw material bought", get: (f: Fin) => f.rmRate, fmt: perKg, goodWhen: "down" as const, note: "HDPE, master batch and pigment purchase rate" },
        { label: "Kg sold", get: (f: Fin) => f.salesKg, fmt: kg, goodWhen: "up" as const },
    ];

    const plRows: { label: string; get: (f: Fin) => number; strong?: boolean; goodWhen: "up" | "down" }[] = [
        { label: "Sales", get: f => f.sales, goodWhen: "up", strong: true },
        { label: "Gross profit", get: f => f.grossProfit, goodWhen: "up" },
        { label: "Overheads (salaries, admin, selling)", get: f => f.overheads, goodWhen: "down" },
        { label: "EBITDA", get: f => f.ebitda, goodWhen: "up" },
        { label: "Depreciation", get: f => f.depreciation, goodWhen: "down" },
        { label: "Finance cost", get: f => f.finance, goodWhen: "down" },
        { label: "Net profit", get: f => f.netProfit, goodWhen: "up", strong: true },
    ];

    return (
        <>
            <Verdict
                figures={[
                    { label: "Gross margin", value: pct(cur.grossMargin), note: base && <Delta value={(cur.grossMargin ?? 0) - (base.grossMargin ?? 0)} text={`${pts((cur.grossMargin ?? 0) - (base.grossMargin ?? 0))} vs ${base.period.month}`} /> },
                    { label: "EBITDA", value: inr(cur.ebitda), note: base && <Delta value={cur.ebitda - base.ebitda} text={`${inr(cur.ebitda - base.ebitda, { signed: true })} vs ${base.period.month}`} /> },
                    { label: "Net margin", value: pct(cur.netMargin), note: base && <Delta value={(cur.netMargin ?? 0) - (base.netMargin ?? 0)} text={`${pts((cur.netMargin ?? 0) - (base.netMargin ?? 0))} vs ${base.period.month}`} /> },
                    { label: "Production cost per kg", value: perKg(cur.costPerKg), note: dCost != null && base && <Delta value={dCost} goodWhen="down" text={`${perKg(dCost, { signed: true })} vs ${base.period.month}`} /> },
                ]}
            >
                {verdict}
            </Verdict>

            <Section
                finding={base && dCost != null && dPrice != null
                    ? `Per kg, ${monthName(cur)} earned ${perKg(cur.salesKg ? cur.grossProfit / cur.salesKg : null)} gross profit, against ${perKg(base.salesKg ? base.grossProfit / base.salesKg : null)} in ${label(base.period)}`
                    : "Economics per kg sold"}
                note="The unit a filament maker manages margin in. Standing compares this month with the last 12."
            >
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[680px]">
                        <thead><tr>
                            <Th>Per kg</Th><Th right>{shortLabel(cur.period)}</Th>{base && <Th right>{shortLabel(base.period)}</Th>}{base && <Th right>Change</Th>}<Th right>12-month average</Th><Th>Standing</Th>
                        </tr></thead>
                        <tbody>
                            {perKgRows.map(r => {
                                const c = r.get(cur), b = base ? r.get(base) : null;
                                const a = avg(r.get);
                                return (
                                    <tr key={r.label}>
                                        <th scope="row" className="text-left px-2.5 py-2.5 border-b border-border font-semibold">
                                            {r.label}{r.note && <span className="block text-[12.5px] font-normal text-muted-foreground">{r.note}</span>}
                                        </th>
                                        <Td right strong>{r.fmt(c)}</Td>
                                        {base && <Td right>{r.fmt(b)}</Td>}
                                        {base && <Td right>{c != null && b != null ? <Delta value={c - b} goodWhen={r.goodWhen} text={r.label === "Kg sold" ? pct(change(c, b), { signed: true }) : perKg(c - b, { signed: true })} /> : "—"}</Td>}
                                        <Td right className="text-muted-foreground">{r.fmt(a)}</Td>
                                        <Td><StandingTag standing={standing(c, history.map(r.get), r.goodWhen === "up")} /></Td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Section>

            <Section
                finding={marginSt
                    ? `Net margin of ${pct(cur.netMargin)} is ${marginSt.words.toLowerCase()}`
                    : `Net margin by month`}
                note={`Net profit as a share of sales, ${shortLabel(series[0].period)} to ${shortLabel(cur.period)}. The 12-month average is ${pct(avg(f => f.netMargin))}.`}
            >
                <BarSeries
                    caption="Net margin by month"
                    format={v => pct(v)}
                    points={series.map((f, i) => ({ label: shortLabel(f.period), value: f.netMargin, current: f === cur, unusual: flags[i] && f !== cur }))}
                />
            </Section>

            <Section
                finding={base ? `Profit and loss, ${label(cur.period)} against ${label(base.period)}` : `Profit and loss, ${label(cur.period)}`}
                note="MIS definitions (the MTY sheet). The full ledger lines are under Statements."
            >
                {!base && <div className="mb-4"><Notice tone="neutral">No figures for the comparison month.</Notice></div>}
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[720px]">
                        <thead><tr>
                            <Th />
                            <Th right>{shortLabel(cur.period)}</Th>
                            {base && <Th right>{shortLabel(base.period)}</Th>}
                            {base && <Th right>Change</Th>}
                            {other && <Th right>{shortLabel(other.period)}</Th>}
                            <Th right>Share of sales</Th>
                        </tr></thead>
                        <tbody>
                            {plRows.map(r => (
                                <tr key={r.label}>
                                    <th scope="row" className={`text-left px-2.5 py-2.5 border-b border-border ${r.strong ? "font-bold" : "font-semibold"}`}>{r.label}</th>
                                    <Td right strong={r.strong} className={r.get(cur) < 0 ? "text-destructive" : undefined}>{inr(r.get(cur))}</Td>
                                    {base && <Td right className={r.get(base) < 0 ? "text-destructive" : undefined}>{inr(r.get(base))}</Td>}
                                    {base && <Td right><Delta value={r.get(cur) - r.get(base)} goodWhen={r.goodWhen} text={inr(r.get(cur) - r.get(base), { signed: true })} /></Td>}
                                    {other && <Td right className={`text-muted-foreground ${r.get(other) < 0 ? "!text-destructive" : ""}`}>{inr(r.get(other))}</Td>}
                                    <Td right className="text-muted-foreground">{cur.sales ? pct((r.get(cur) / cur.sales) * 100) : "—"}</Td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Section>
        </>
    );
}
