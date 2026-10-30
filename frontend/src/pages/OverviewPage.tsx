import { ArrowRight } from "lucide-react";
import { Verdict, Section, Delta, Notice, UploadButton, LinkButton } from "@/components/review/parts";
import { StandingTable } from "@/components/review/StandingTable";
import { ProfitBridge } from "@/components/review/ProfitBridge";
import { baseOf, bridge, costMovers, standing } from "@/lib/review";
import { change, inr, pct, perKg, pts } from "@/lib/money";
import { label } from "@/lib/period";
import { healthSigns, largestStep, monthName, stepSentence, asOfNote, causeClause, standingsClaim } from "@/lib/narrative";
import type { PageId } from "@/hooks/useRoute";
import type { ReviewPageProps } from "@/pages/types";

interface Attention { tone: "bad" | "watch" | "neutral"; text: string; page: PageId; cta: string }

export function OverviewPage({ review, compare, go }: ReviewPageProps) {
    const { cur } = review;
    const base = baseOf(review, compare);
    const baseName = base ? label(base.period) : null;
    const b = base ? bridge(base, cur) : null;
    const top = b ? largestStep(b.steps) : null;
    const dProfit = base ? cur.netProfit - base.netProfit : null;
    const month = monthName(cur);

    // ── Verdict ──
    const result = cur.netProfit >= 0
        ? <>{month} made {inr(cur.netProfit)} net profit</>
        : <>{month} made a <span className="text-destructive">net loss of {inr(Math.abs(cur.netProfit))}</span></>;
    const vs = dProfit == null || !baseName ? null
        : dProfit < 0 ? <>, <span className="text-destructive">{inr(Math.abs(dProfit))} less</span> than {baseName}</>
            : <>, {inr(dProfit)} more than {baseName}</>;
    // The cause rides in the verdict when the biggest step pushed profit the same way it moved.
    const cause = base && top && dProfit != null && Math.sign(top.value) === Math.sign(dProfit)
        ? causeClause(top, cur, base, review.history) : null;

    // ── Needs attention ──
    const attention: Attention[] = [];
    const costStanding = standing(cur.costPerKg, review.history.map(f => f.costPerKg), false);
    if (costStanding && costStanding.tone === "bad")
        attention.push({ tone: "bad", text: `Production cost of ${perKg(cur.costPerKg)} is ${costStanding.words.toLowerCase()}.`, page: "profit", cta: "Profit & margin" });
    const prevMovers = review.prev ? costMovers(cur, review.prev) : [];
    const riser = prevMovers.find(m => m.delta > 1e5);
    if (riser) attention.push({ tone: "watch", text: `${riser.label} up ${inr(riser.delta)} on last month, to ${inr(riser.cur)}.`, page: "costs", cta: "Costs" });
    if (review.contribution) {
        const losers = review.contribution.filter(r => r.contribution_per_kg < 0);
        if (losers.length)
            attention.push({ tone: "bad", text: `${losers.length} of ${review.contribution.length} products sold below cost, losing ${inr(Math.abs(losers.reduce((s, r) => s + r.contribution_value, 0)))}.`, page: "products", cta: "Products & pricing" });
    } else {
        attention.push({ tone: "neutral", text: `Product margins for ${month} are missing: the item-sales file has not been uploaded.`, page: "products", cta: "Products & pricing" });
    }
    const stockStanding = standing(cur.stockCover, review.history.map(f => f.stockCover), false);
    if (stockStanding && stockStanding.tone === "bad")
        attention.push({ tone: "watch", text: `${inr(cur.closingStock)} is held in stock, ${cur.stockCover?.toFixed(1)} months of sales (${stockStanding.words.toLowerCase()}).`, page: "inventory", cta: "Inventory" });
    if (review.kpiSource !== cur)
        attention.push({ tone: "neutral", text: `The ${month} balance sheet is not uploaded, so cash and debt figures use ${review.kpiSource ? label(review.kpiSource.period) : "older data"}.`, page: "health", cta: "Financial health" });

    const signs = healthSigns(review);

    return (
        <>
            <Verdict
                figures={[
                    { label: "Sales", value: inr(cur.sales), note: base && <Delta value={change(cur.sales, base.sales)} text={`${pct(change(cur.sales, base.sales), { signed: true })} vs ${base.period.month}`} /> },
                    { label: "Net profit", value: <span className={cur.netProfit < 0 ? "text-destructive" : undefined}>{inr(cur.netProfit)}</span>, note: base && <Delta value={dProfit} text={`${inr(dProfit, { signed: true })} vs ${base.period.month}`} /> },
                    { label: "Net margin", value: pct(cur.netMargin), note: base && <Delta value={(cur.netMargin ?? 0) - (base.netMargin ?? 0)} text={`${pts((cur.netMargin ?? 0) - (base.netMargin ?? 0))} vs ${base.period.month}`} /> },
                    { label: "Production cost per kg", value: perKg(cur.costPerKg), note: base && cur.costPerKg != null && base.costPerKg != null && <Delta value={cur.costPerKg - base.costPerKg} goodWhen="down" text={`${perKg(cur.costPerKg - base.costPerKg, { signed: true })} vs ${base.period.month}`} /> },
                ]}
            >
                {result}{vs}{cause && <>, because {cause}</>}.
            </Verdict>

            {!base && (
                <Notice tone="neutral">
                    No figures for {compare === "ly" ? "the same month last year" : "the previous month"}, so there is nothing to compare against. Try the other comparison in the header.
                </Notice>
            )}

            <div className="grid xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)] gap-5 items-start">
                {b && base && top ? (
                    <Section
                        finding={stepSentence(top, cur, base)}
                        note={`How net profit moved from ${baseName} to ${label(cur.period)}. Every step is drawn to the same scale and the steps add up to the total.`}
                        action={<LinkButton onClick={() => go("profit")}>Profit & margin</LinkButton>}
                    >
                        <ProfitBridge bridge={b} fromLabel={baseName!} toLabel={label(cur.period)} />
                    </Section>
                ) : <div />}

                <Section
                    finding={attention.length ? "Needs attention" : "Nothing outside its usual range"}
                    note={attention.length ? "The biggest issues first, each linked to the page that explains it." : `Every measure for ${month} sits within its 12-month range.`}
                >
                    <ul className="flex flex-col">
                        {attention.slice(0, 5).map((a, i) => (
                            <li key={i} className="flex gap-3 py-3 border-b border-border last:border-0">
                                <span aria-hidden className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${a.tone === "bad" ? "bg-destructive" : a.tone === "watch" ? "bg-warning" : "bg-muted-foreground/50"}`} />
                                <div className="min-w-0">
                                    <p className="font-semibold text-pretty">{a.text}</p>
                                    <button type="button" onClick={() => go(a.page)} className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline underline-offset-4">
                                        {a.cta} <ArrowRight size={14} aria-hidden />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </Section>
            </div>

            <Section
                finding={standingsClaim(signs, "Margin, cash, stock and debt")}
                note="Each measure is compared with this company's own recent months, not an outside benchmark."
                action={<LinkButton onClick={() => go("health")}>Financial health</LinkButton>}
            >
                {review.kpiSource !== cur && (
                    <div className="mb-4">
                        <Notice action={<UploadButton>Upload balance sheet</UploadButton>}>
                            {month} balance sheet not uploaded. Cash cycle and debt use {asOfNote(review.kpiSource, cur)}.
                        </Notice>
                    </div>
                )}
                <StandingTable
                    groups={[{ rows: signs.map(sg => ({
                        key: sg.id, label: sg.label, definition: sg.definition, value: sg.value, fmt: sg.fmt, standing: sg.standing,
                        asOf: sg.asOf && sg.asOf !== cur ? `${sg.asOf.period.month} figure` : null,
                    })) }]}
                />
            </Section>
        </>
    );
}

