import { Verdict, Section, Notice, UploadButton } from "@/components/review/parts";
import { StandingTable } from "@/components/review/StandingTable";
import { BarSeries } from "@/components/review/BarSeries";
import { KPI, standing } from "@/lib/review";
import { num } from "@/lib/money";
import { label, shortLabel } from "@/lib/period";
import { monthName } from "@/lib/narrative";
import type { ReviewPageProps } from "@/pages/types";

interface Measure {
    key: string;
    label: string;
    group: "Cash" | "Liquidity" | "Debt";
    fmt: (v: number) => string;
    higherIsBetter: boolean | null;
    definition: string;
}

const days = (v: number) => `${Math.round(v)} days`;
const times = (v: number) => `${num(v, 1)}×`;

const MEASURES: Measure[] = [
    { key: KPI.ccc, label: "Cash cycle", group: "Cash", fmt: days, higherIsBetter: false, definition: "Days from paying for material to collecting from customers." },
    { key: KPI.dio, label: "Days of inventory", group: "Cash", fmt: days, higherIsBetter: false, definition: "How long stock sits before it is sold." },
    { key: KPI.dso, label: "Days to collect", group: "Cash", fmt: days, higherIsBetter: false, definition: "How long customers take to pay." },
    { key: KPI.dpo, label: "Days to pay suppliers", group: "Cash", fmt: days, higherIsBetter: null, definition: "How long we take to pay suppliers." },
    { key: KPI.currentRatio, label: "Current ratio", group: "Liquidity", fmt: v => num(v, 1), higherIsBetter: true, definition: "Short-term assets for every rupee of short-term liabilities." },
    { key: KPI.quickRatio, label: "Quick ratio", group: "Liquidity", fmt: v => num(v, 1), higherIsBetter: true, definition: "The same, leaving out stock." },
    { key: KPI.debtEquity, label: "Debt to equity", group: "Debt", fmt: v => num(v, 2), higherIsBetter: false, definition: "Borrowings for every rupee of owners' funds." },
    { key: KPI.interestCoverage, label: "Interest cover", group: "Debt", fmt: times, higherIsBetter: true, definition: "Operating profit divided by interest. Below 1× means interest is not covered." },
];

export function HealthPage({ review }: ReviewPageProps) {
    const { cur, history, kpiSource } = review;

    if (!kpiSource) {
        return (
            <>
                <Verdict>No balance sheet has been uploaded for {label(cur.period)} or the three months before it.</Verdict>
                <Notice action={<UploadButton>Upload balance sheet</UploadButton>}>
                    Cash cycle, liquidity and debt measures come from the balance sheet in the monthly MIS or Tally BS file.
                </Notice>
            </>
        );
    }

    const hist = history.filter(f => f !== kpiSource && f.period.fy + f.period.month !== kpiSource.period.fy + kpiSource.period.month);
    const rows = MEASURES.map(m => {
        const value = kpiSource.kpi[m.key] ?? null;
        return { ...m, value, standing: standing(value, hist.map(f => f.kpi[m.key] ?? null), m.higherIsBetter) };
    });
    const extreme = (r: typeof rows[number]) => r.standing?.position === "lowest" || r.standing?.position === "highest";
    const bad = rows.filter(r => r.standing?.tone === "bad");
    const best = rows.filter(r => r.standing?.tone === "good" && extreme(r));
    const stale = kpiSource !== cur;
    const span = hist.length;

    // Phrase the verdict by area: "Liquidity is the thinnest in 11 months" beats a list of ratio names.
    const AREA: Record<Measure["group"], { weak: string; strong: string }> = {
        Cash: { weak: "cash is coming back slower than usual", strong: "cash is coming back faster than usual" },
        Liquidity: { weak: `liquidity is the thinnest in ${span} months`, strong: `liquidity is the strongest in ${span} months` },
        Debt: { weak: "debt is heavier than usual", strong: "debt is lighter than usual" },
    };
    const weakAreas = [...new Set(bad.map(r => r.group))];
    const strongOnly = best.filter(r => !weakAreas.includes(r.group));
    const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
    const detail = (xs: typeof rows) => xs.map(r => `${r.label.toLowerCase()} ${fmtOr(r)}`).join(", ");

    // Strip: flagged measures first, so the figures back the sentence above them.
    const stripRows = [...bad, ...best, ...rows.filter(r => !bad.includes(r) && !best.includes(r))].slice(0, 4);

    const cccSeries = review.series.map(f => ({ label: shortLabel(f.period), value: f.kpi[KPI.ccc] ?? null, current: f === kpiSource }));

    return (
        <>
            {stale && (
                <Notice action={<UploadButton>Upload {monthName(cur)} balance sheet</UploadButton>}>
                    Latest balance sheet: {label(kpiSource.period)}. {monthName(cur)} has not been uploaded, so this page shows {kpiSource.period.month} figures.
                </Notice>
            )}

            <Verdict
                figures={stripRows.map(r => ({
                    label: r.label,
                    value: <span className={r.standing?.tone === "bad" ? "text-destructive" : r.standing?.tone === "good" ? "text-primary" : undefined}>{fmtOr(r)}</span>,
                    note: r.standing ? r.standing.words : "No history",
                }))}
            >
                {weakAreas.length === 0
                    ? <>Cash, liquidity and debt for {label(kpiSource.period)} are within or better than their usual range{strongOnly.length ? <>; {strongOnly.map(r => `${r.label.toLowerCase()} is ${r.standing!.words.toLowerCase()}`).join(", ")}</> : null}.</>
                    : <>
                        <span className="text-destructive">{cap(weakAreas.map(g => AREA[g].weak).join(" and "))}</span>{" "}
                        <span className="text-muted-foreground font-semibold">({detail(bad)})</span>.
                        {strongOnly.length > 0 && <> On the strong side, {[...new Set(strongOnly.map(r => r.group))].map(g => AREA[g].strong).join(" and ")}.</>}
                    </>}
            </Verdict>

            <Section
                finding={`Every measure against its own past ${span} months`}
                note="Thin line: the full past range. Thick band: the usual range, where half of past months fell. Mark: now. What is normal for this business is the yardstick, not an outside benchmark."
            >
                <StandingTable
                    groups={(["Cash", "Liquidity", "Debt"] as const).map(g => ({
                        name: g,
                        rows: rows.filter(r => r.group === g).map(r => ({ key: r.key, label: r.label, definition: r.definition, value: r.value, fmt: r.fmt, standing: r.standing })),
                    }))}
                />
            </Section>

            <Section
                finding={rows[0].standing ? `The cash cycle is ${rows[0].standing.words.toLowerCase()} at ${fmtOr(rows[0])}` : "Cash cycle by month"}
                note="Fewer days means cash comes back faster. Months without a balance sheet are left blank."
            >
                <BarSeries caption="Cash cycle in days by month" format={v => `${Math.round(v)}`} points={cccSeries} />
            </Section>
        </>
    );
}

function fmtOr(r: { value: number | null; fmt: (v: number) => string }) {
    return r.value == null ? "—" : r.fmt(r.value);
}
