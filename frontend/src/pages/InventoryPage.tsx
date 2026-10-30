import { useEffect, useState } from "react";
import { Verdict, Section, Delta, StandingTag, Th, Td, Notice } from "@/components/review/parts";
import { BarSeries } from "@/components/review/BarSeries";
import { api } from "@/api";
import { baseOf, standing } from "@/lib/review";
import { change, inr, kg, pct, perKg } from "@/lib/money";
import { label, shortLabel, type Period } from "@/lib/period";
import { monthName } from "@/lib/narrative";
import type { ConsumptionRow } from "@/types";
import type { ReviewPageProps } from "@/pages/types";

/** Subtotal rows in the consumption output; shown as totals, never summed with materials. */
const SUBTOTALS = new Set(["Raw Material Consumption", "Total Monofil Consumption"]);
/** Below this many kg consumed, a rate swing is noise and is not coloured as good or bad. */
const MATERIAL_KG = 100;
const MATERIAL: Record<string, string> = { HDPE: "HDPE granules", MB: "Master batch", CP: "Colour pigment" };

function useConsumption(p: Period | null) {
    const [rows, setRows] = useState<ConsumptionRow[] | null>(null);
    useEffect(() => {
        if (!p) { setRows([]); return; }
        let cancelled = false;
        api.consumption([p.month], p.fy).then(r => { if (!cancelled) setRows(r.data as ConsumptionRow[]); }).catch(() => { if (!cancelled) setRows([]); });
        return () => { cancelled = true; };
    }, [p?.fy, p?.month]);
    return rows;
}

export function InventoryPage({ review, compare }: ReviewPageProps) {
    const { cur, history, series } = review;
    const base = baseOf(review, compare);
    const rows = useConsumption(cur.period);
    const baseRows = useConsumption(base?.period ?? null);

    const coverSt = standing(cur.stockCover, history.map(f => f.stockCover), false);
    const dStock = base && cur.closingStock != null && base.closingStock != null ? cur.closingStock - base.closingStock : null;
    const materials = (rows ?? []).filter(r => !SUBTOTALS.has(r.material));
    const rmTotal = (rows ?? []).find(r => r.material === "Raw Material Consumption");
    const baseOfMaterial = (m: string) => baseRows?.find(r => r.material === m) ?? null;

    return (
        <>
            <Verdict
                figures={[
                    { label: "Stock held", value: inr(cur.closingStock), note: base && dStock != null && <Delta value={dStock} goodWhen="down" text={`${inr(dStock, { signed: true })} vs ${base.period.month}`} /> },
                    { label: "Stock in kg", value: kg(cur.closingStockKg), note: base && cur.closingStockKg != null && base.closingStockKg != null && <Delta value={cur.closingStockKg - base.closingStockKg} goodWhen="down" text={`${pct(change(cur.closingStockKg, base.closingStockKg), { signed: true })} vs ${base.period.month}`} /> },
                    { label: "Stock cover", value: cur.stockCover == null ? "—" : `${cur.stockCover.toFixed(1)} months`, note: "Of this month's sales" },
                    { label: "Raw material bought at", value: perKg(cur.rmRate), note: base && cur.rmRate != null && base.rmRate != null && <Delta value={cur.rmRate - base.rmRate} goodWhen="down" text={`${perKg(cur.rmRate - base.rmRate, { signed: true })} vs ${base.period.month}`} /> },
                ]}
            >
                {inr(cur.closingStock)} is tied up in stock at the end of {monthName(cur)}, {cur.stockCover?.toFixed(1)} months of sales
                {coverSt && coverSt.position !== "usual"
                    ? <>, <span className={coverSt.tone === "bad" ? "text-destructive" : undefined}>{coverSt.words.toLowerCase()}</span>.</>
                    : "."}
            </Verdict>

            <Section
                finding={dStock != null && base
                    ? `Stock ${dStock >= 0 ? "grew" : "came down"} by ${inr(Math.abs(dStock))} since ${label(base.period)}`
                    : "Closing stock by month"}
                note={`Value of closing stock at the end of each month, ${shortLabel(series[0].period)} to ${shortLabel(cur.period)}.`}
                action={coverSt ? <StandingTag standing={coverSt} /> : undefined}
            >
                <BarSeries
                    caption="Closing stock value by month"
                    format={v => inr(v)}
                    points={series.map(f => ({ label: shortLabel(f.period), value: f.closingStock, current: f === cur }))}
                />
            </Section>

            <Section
                finding={rmTotal
                    ? `${kg(rmTotal.qty)} of raw material went into production at ${perKg(rmTotal.rate)}`
                    : "Raw material movement"}
                note="Opening stock, plus purchases, minus closing stock, gives what was consumed. Kg and the rate paid per kg."
            >
                {rows == null ? (
                    <div className="h-40 rounded-md bg-muted animate-pulse" aria-busy="true" aria-label="Loading raw material movement" />
                ) : materials.length === 0 ? (
                    <Notice tone="neutral">No raw material movement was uploaded for {label(cur.period)}.</Notice>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[780px]">
                            <thead><tr>
                                <Th>Material</Th><Th right>Opening</Th><Th right>Bought</Th><Th right>Closing</Th><Th right>Consumed</Th><Th right>Rate</Th>{base && <Th right>Rate change</Th>}
                            </tr></thead>
                            <tbody>
                                {[...materials, ...(rmTotal ? [rmTotal] : [])].map(r => {
                                    const b = baseOfMaterial(r.material);
                                    const isTotal = r === rmTotal;
                                    return (
                                        <tr key={r.material}>
                                            <th scope="row" className={`text-left px-2.5 py-2.5 border-b border-border ${isTotal ? "font-bold" : "font-semibold"}`}>
                                                {isTotal ? "All raw material" : MATERIAL[r.material] ?? r.material}
                                            </th>
                                            <Td right>{kg(r.opening_stock_qty)}</Td>
                                            <Td right>{kg(r.purchases_qty)}</Td>
                                            <Td right>{kg(r.closing_stock_qty)}</Td>
                                            <Td right strong>{kg(r.qty)}</Td>
                                            <Td right>{perKg(r.rate)}</Td>
                                            {base && <Td right>{b?.rate != null && r.rate != null ? <Delta value={r.rate - b.rate} goodWhen={r.qty >= MATERIAL_KG ? "down" : "none"} text={perKg(r.rate - b.rate, { signed: true })} /> : "—"}</Td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </Section>
        </>
    );
}
