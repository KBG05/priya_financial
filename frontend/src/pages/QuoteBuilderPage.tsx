import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/api";
import type { QuoteBuilderSku, QuoteBuilderSkuOption, QuoteBuilderStockRow } from "@/types";

interface Props { fy?: string; }

type Sourcing = "Produce in-house" | "Purchase & resell";

type Verdict = "REJECT" | "CAUTION" | "ACCEPTABLE" | "STRONG";

const VERDICT_STYLE: Record<Verdict, string> = {
    REJECT: "bg-destructive/15 text-destructive border-destructive/40",
    CAUTION: "bg-warning/15 text-warning border-warning/40",
    ACCEPTABLE: "bg-primary/10 text-primary border-primary/30",
    STRONG: "bg-primary/20 text-primary border-primary/50",
};

const VERDICT_LABEL: Record<Verdict, string> = {
    REJECT: "REJECT — loss per kg",
    CAUTION: "CAUTION — thin margin",
    ACCEPTABLE: "ACCEPTABLE",
    STRONG: "STRONG",
};

/** Round up to the nearest `step` (mirrors Excel CEILING.MATH). */
function ceilingToStep(value: number, step: number): number {
    if (!step) return value;
    return Math.ceil(value / step) * step;
}

/** Number formatter for Quote Builder fields — 0 is a legitimate value here, not "missing". */
function num(v: number): string {
    if (v == null || isNaN(v)) return "—";
    return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handler = () => setReduced(mq.matches);
        mq.addEventListener("change", handler);
        return () => mq.removeEventListener("change", handler);
    }, []);
    return reduced;
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Smoothly tweens a displayed number toward `target` whenever it changes, instead of
 * snapping — makes the Deal Verdict band read as live-recalculating rather than a static
 * re-render. Interrupting mid-animation re-anchors from the current displayed value, so
 * rapid keystrokes chain smoothly instead of jumping. Skips animation entirely under
 * prefers-reduced-motion.
 */
function useAnimatedNumber(target: number, durationMs = 350): number {
    const reducedMotion = usePrefersReducedMotion();
    const [display, setDisplay] = useState(target);
    const stateRef = useRef({ display: target, raf: 0 });

    useEffect(() => {
        if (reducedMotion || !Number.isFinite(target)) {
            cancelAnimationFrame(stateRef.current.raf);
            stateRef.current.display = target;
            setDisplay(target);
            return;
        }
        const from = stateRef.current.display;
        if (from === target) return;
        const start = performance.now();
        cancelAnimationFrame(stateRef.current.raf);

        function tick(now: number) {
            const t = Math.min(1, (now - start) / durationMs);
            const value = from + (target - from) * easeOutCubic(t);
            stateRef.current.display = value;
            setDisplay(value);
            if (t < 1) stateRef.current.raf = requestAnimationFrame(tick);
        }
        stateRef.current.raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(stateRef.current.raf);
    }, [target, durationMs, reducedMotion]);

    return display;
}

export function QuoteBuilderPage({ fy }: Props) {
    const [skuOptions, setSkuOptions] = useState<QuoteBuilderSkuOption[]>([]);
    const [skuSearch, setSkuSearch] = useState("");
    const [skuOpen, setSkuOpen] = useState(false);
    const [skuHighlight, setSkuHighlight] = useState(0);
    const [selectedCode, setSelectedCode] = useState<number | null>(null);
    const [inStockOnly, setInStockOnly] = useState(true);

    const [sku, setSku] = useState<QuoteBuilderSku | null>(null);
    const [stock, setStock] = useState<QuoteBuilderStockRow[]>([]);
    const [skuLoading, setSkuLoading] = useState(false);
    const [skuWarning, setSkuWarning] = useState<string | null>(null);

    const [sourcing, setSourcing] = useState<Sourcing>("Produce in-house");
    const [ratePerMt, setRatePerMt] = useState<string>("");
    const [proposedQty, setProposedQty] = useState<string>("1");
    const [purchaseRate, setPurchaseRate] = useState<string>("");
    const [vcOverride, setVcOverride] = useState<string | null>(null);

    useEffect(() => {
        api.quoteBuilderSkus(fy, inStockOnly).then(r => setSkuOptions(r.data)).catch(() => setSkuOptions([]));
    }, [fy, inStockOnly]);

    useEffect(() => {
        if (selectedCode == null) { setSku(null); setStock([]); return; }
        setSkuLoading(true);
        setSkuWarning(null);
        setVcOverride(null);
        Promise.all([
            api.quoteBuilderSku(selectedCode, fy),
            api.quoteBuilderStock(selectedCode),
        ]).then(([skuRes, stockRes]) => {
            setSku(skuRes.data);
            setSkuWarning(skuRes.warning ?? null);
            setStock(stockRes.data);
            setPurchaseRate(skuRes.data ? String(skuRes.data.hist_purchase_rate_per_kg ?? 0) : "");
            setSkuLoading(false);
        }).catch(() => setSkuLoading(false));
    }, [selectedCode, fy]);

    const filteredSkus = useMemo(() => {
        const q = skuSearch.trim().toLowerCase();
        if (!q) return skuOptions.slice(0, 50);
        return skuOptions.filter(
            o => o.product_name.toLowerCase().includes(q) || String(o.code).includes(q)
        ).slice(0, 50);
    }, [skuOptions, skuSearch]);

    // Keep the highlighted option in range whenever the filtered list changes underneath it.
    useEffect(() => {
        setSkuHighlight(0);
    }, [filteredSkus]);

    function chooseSku(code: number) {
        setSelectedCode(code);
        setSkuOpen(false);
        setSkuSearch("");
    }

    function onSkuSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (!skuOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setSkuOpen(true);
                setSkuSearch("");
            }
            return;
        }
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSkuHighlight(i => Math.min(i + 1, filteredSkus.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSkuHighlight(i => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = filteredSkus[skuHighlight];
            if (opt) chooseSku(opt.code);
        } else if (e.key === "Escape") {
            e.preventDefault();
            setSkuOpen(false);
        }
    }

    const wtPerMt = sku?.mts_per_kg && sku.mts_per_kg > 0 ? 1 / sku.mts_per_kg : 0; // Wt/Mt = kg per metre
    const wtPerRoll = wtPerMt > 0 ? wtPerMt * (selectedCode != null && selectedCode < 300 ? 50 : 30) : 0;

    const rate = parseFloat(ratePerMt) || 0;
    const qty = parseFloat(proposedQty) || 0;
    const purchRate = parseFloat(purchaseRate) || 0;

    const proposedSalePrice = wtPerMt > 0 ? ceilingToStep(rate / wtPerMt, 0.5) : 0;
    const ratePerKgHint = wtPerMt > 0 && rate > 0 ? rate / wtPerMt : 0;

    const stockTotalKg = stock.reduce((s, r) => s + (r.qty_kgs ?? 0), 0);
    const stockTotalBales = stock.reduce((s, r) => s + (r.bales ?? 0), 0);
    const stockShortfallKg = qty > 0 ? qty - stockTotalKg : 0;
    const stockCovers = qty > 0 && stockTotalKg >= qty;

    const hasCostData = sku?.has_cost_data ?? false;
    const liveVariableCost = sourcing === "Produce in-house"
        ? (sku?.mfg_cost_per_kg ?? 0)
        : purchRate;
    const variableCost = vcOverride !== null ? (parseFloat(vcOverride) || 0) : liveVariableCost;
    const variableCostIsKnown = vcOverride !== null || sourcing === "Purchase & resell" || hasCostData;

    const contributionPerKg = proposedSalePrice - variableCost;
    const pvRatio = proposedSalePrice > 0 ? contributionPerKg / proposedSalePrice : 0;
    const totalContribution = contributionPerKg * qty;
    const floorSp = variableCost;
    const spFor15 = variableCost > 0 ? variableCost / 0.85 : 0;

    const verdict: Verdict = contributionPerKg < 0
        ? "REJECT"
        : pvRatio < 0.10
        ? "CAUTION"
        : pvRatio < 0.20
        ? "ACCEPTABLE"
        : "STRONG";

    const canQuote = proposedSalePrice > 0 && variableCostIsKnown;
    const selectedOption = skuOptions.find(o => o.code === selectedCode);

    // Live Deal Verdict: every displayed number tweens toward its new value instead of
    // snapping, and the verdict badge pulses when a keystroke pushes the deal across a
    // REJECT/CAUTION/ACCEPTABLE/STRONG threshold.
    const animVariableCost = useAnimatedNumber(variableCost);
    const animContributionPerKg = useAnimatedNumber(contributionPerKg);
    const animPvRatio = useAnimatedNumber(pvRatio);
    const animTotalContribution = useAnimatedNumber(totalContribution);
    const animFloorSp = useAnimatedNumber(floorSp);
    const animSpFor15 = useAnimatedNumber(spFor15);

    const [verdictPulsing, setVerdictPulsing] = useState(false);
    const prevVerdictRef = useRef(verdict);
    useEffect(() => {
        if (canQuote && prevVerdictRef.current !== verdict) {
            setVerdictPulsing(true);
            const t = setTimeout(() => setVerdictPulsing(false), 500);
            prevVerdictRef.current = verdict;
            return () => clearTimeout(t);
        }
        prevVerdictRef.current = verdict;
    }, [verdict, canQuote]);

    function resetDeal() {
        setRatePerMt("");
        setProposedQty("1");
        setVcOverride(null);
        setSourcing("Produce in-house");
        if (sku) setPurchaseRate(String(sku.hist_purchase_rate_per_kg ?? 0));
    }

    return (
        <div className="flex flex-col gap-3 min-w-0 w-full">
            {/* ── SKU picker ── */}
            <Card className="card-elevated py-0 gap-0">
                <CardContent className="p-2.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative w-full sm:max-w-lg">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            role="combobox"
                            aria-label="Search SKU code or product name"
                            aria-expanded={skuOpen}
                            aria-controls="sku-listbox"
                            aria-autocomplete="list"
                            aria-activedescendant={skuOpen && filteredSkus[skuHighlight] ? `sku-option-${filteredSkus[skuHighlight].code}` : undefined}
                            value={skuOpen ? skuSearch : (selectedOption ? `${selectedOption.code} — ${selectedOption.product_name}` : skuSearch)}
                            onChange={e => { setSkuSearch(e.target.value); setSkuOpen(true); }}
                            onFocus={() => { setSkuOpen(true); setSkuSearch(""); }}
                            onKeyDown={onSkuSearchKeyDown}
                            placeholder="Search SKU code or product name…"
                            className="h-8 pl-9 pr-8 text-sm"
                        />
                        {selectedOption && !skuOpen && (
                            <button
                                onClick={() => { setSelectedCode(null); setSkuSearch(""); }}
                                aria-label="Clear selected SKU"
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            >
                                <X size={14} />
                            </button>
                        )}
                        {skuOpen && (
                            <div id="sku-listbox" role="listbox" className="absolute z-40 mt-1 w-full max-h-80 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                                {filteredSkus.length === 0 ? (
                                    <div className="px-3 py-3 text-sm text-muted-foreground">
                                        No matching SKUs{inStockOnly ? " with stock on hand." : "."}
                                    </div>
                                ) : filteredSkus.map((o, i) => (
                                    <button
                                        key={o.code}
                                        id={`sku-option-${o.code}`}
                                        role="option"
                                        aria-selected={i === skuHighlight}
                                        onClick={() => chooseSku(o.code)}
                                        onMouseEnter={() => setSkuHighlight(i)}
                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${i === skuHighlight ? "bg-muted/50" : ""}`}
                                    >
                                        <span className="text-muted-foreground w-10 shrink-0 tabular-nums text-xs">{o.code}</span>
                                        <span className="text-foreground">{o.product_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {skuOpen && (
                            <div className="fixed inset-0 z-30" onClick={() => setSkuOpen(false)} />
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={inStockOnly}
                            onChange={e => setInStockOnly(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        />
                        Only show SKUs with stock on hand
                    </label>

                    {sku && (
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0 sm:ml-auto" onClick={resetDeal}>
                            <RotateCcw size={13} /> Reset deal terms
                        </Button>
                    )}
                </CardContent>
            </Card>

            {selectedCode == null && (
                <p className="text-sm text-muted-foreground px-1">Pick a SKU above to start pricing a deal.</p>
            )}

            {skuLoading && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Skeleton className="h-72" />
                        <Skeleton className="h-72" />
                    </div>
                    <Skeleton className="h-28" />
                </div>
            )}

            {!skuLoading && sku && (
                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* ── Auto-filled SKU info ── */}
                        <Card className="card-elevated py-0 gap-0">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    SKU — {sku.code}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 flex flex-col gap-2.5 text-sm">
                                <div className="font-semibold text-base text-foreground">{sku.product_name}</div>
                                {skuWarning && (
                                    <p className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 rounded-md px-2 py-1.5">
                                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                        {skuWarning}
                                    </p>
                                )}

                                {/* Stock table and cost data run side by side — both fit comfortably without stacking */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stock in hand</span>
                                            {stock.length > 0 && (
                                                <span className="text-[10px] text-muted-foreground">
                                                    as of {stock[0].as_of_date}
                                                </span>
                                            )}
                                        </div>
                                        {stock.length === 0 ? (
                                            <span className="text-muted-foreground text-xs">No stock snapshot for this SKU — zero on hand at last count.</span>
                                        ) : (
                                            <div className="rounded-md border border-border/50 overflow-hidden">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                                                            <th className="text-left font-semibold px-2.5 py-1.5">Unit</th>
                                                            <th className="text-right font-semibold px-2.5 py-1.5">Bales</th>
                                                            <th className="text-right font-semibold px-2.5 py-1.5">Kg</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stock.map(s => (
                                                            <tr key={s.location} className="border-t border-border/30">
                                                                <td className="px-2.5 py-1.5 text-foreground">{s.location}</td>
                                                                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{num(s.bales)}</td>
                                                                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{num(s.qty_kgs)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr className="border-t border-border/60 bg-muted/30">
                                                            <td className="px-2.5 py-1.5 font-semibold text-foreground">Total</td>
                                                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-primary">{num(stockTotalBales)}</td>
                                                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-primary">{num(stockTotalKg)}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-3 sm:border-l sm:border-border/30 sm:pl-4">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mfg cost breakdown</span>
                                                {sku.month && (
                                                    <span className="text-[10px] text-muted-foreground">basis: {sku.month}</span>
                                                )}
                                            </div>
                                            <div className="flex flex-col gap-1.5 pl-2.5 border-l-2 border-border/40">
                                                <Row label="RM" value={sku.has_breakdown ? num(sku.rm_price!) : "No data"} muted={!sku.has_breakdown} />
                                                <Row label="Yarn" value={sku.has_breakdown ? num(sku.yarn_conversion!) : "No data"} muted={!sku.has_breakdown} />
                                                <Row label="Fabricator Cost" value={sku.has_breakdown ? num(sku.fabricator_cost!) : "No data"} muted={!sku.has_breakdown} />
                                                <Row label="Fabric Overheads" value={sku.has_breakdown ? num(sku.fabric_addon!) : "No data"} muted={!sku.has_breakdown} />
                                            </div>
                                            <div className="mt-1.5 pt-1.5 border-t border-border/30">
                                                <Row label="Mfg Cost ₹/Kg (total, live)" value={hasCostData ? num(sku.mfg_cost_per_kg) : "No data"} muted={!hasCostData} emphasize />
                                            </div>
                                        </div>

                                        <div>
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Historical benchmarks</span>
                                            <div className="flex flex-col gap-1.5 mt-1.5">
                                                <Row label="Hist Purchase Rate ₹/Kg" value={hasCostData ? num(sku.hist_purchase_rate_per_kg) : "No data"} muted={!hasCostData} />
                                                <Row label="Hist Avg SP ₹/Kg" value={hasCostData ? num(sku.hist_avg_sp_per_kg) : "No data"} muted={!hasCostData} />
                                                <Row
                                                    label="Wt/Mt"
                                                    value={wtPerMt ? `${wtPerMt.toFixed(4)} kg/m (≈ ${sku.mts_per_kg?.toFixed(2)} m/kg)` : "—"}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ── Deal terms ── */}
                        <Card className="card-elevated py-0 gap-0">
                            <CardHeader className="py-3 px-4">
                                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Quote Terms
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4 flex flex-col gap-2.5 text-sm">
                                <Field label="Sourcing">
                                    <Select value={sourcing} onValueChange={v => setSourcing(v as Sourcing)}>
                                        <SelectTrigger size="sm" className="w-full h-9 text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Produce in-house">Produce in-house</SelectItem>
                                            <SelectItem value="Purchase & resell">Purchase & resell</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </Field>
                                <Field label="Rate per Mt (₹/Metre)">
                                    <Input type="number" step="0.05" value={ratePerMt} onChange={e => setRatePerMt(e.target.value)} className="h-9 text-sm" placeholder="0.00" />
                                    {ratePerKgHint > 0 && (
                                        <span className="text-[11px] text-muted-foreground">
                                            (≈ ₹{ratePerKgHint.toFixed(2)}/kg at this SKU's Wt/Mt)
                                        </span>
                                    )}
                                </Field>
                                <Field label="Proposed Sale Price ₹/Kg (auto)">
                                    <div className="h-9 flex items-center px-3 rounded-md border border-border/50 bg-muted/30 font-semibold tabular-nums text-sm">
                                        {wtPerMt > 0 ? (rate > 0 ? num(proposedSalePrice) : "—") : "Set Wt/Mt first"}
                                    </div>
                                </Field>
                                {wtPerRoll > 0 && (
                                    <Row label="Wt/Roll (kg)" value={wtPerRoll.toFixed(2)} />
                                )}
                                <Field label="Proposed Quantity (Kgs)">
                                    <Input type="number" value={proposedQty} onChange={e => setProposedQty(e.target.value)} className="h-9 text-sm" />
                                    {qty > 0 && (
                                        <span className={`flex items-center gap-1.5 text-[11px] ${stockCovers ? "text-primary" : "text-warning"}`}>
                                            {stockCovers ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                            {stockTotalKg <= 0
                                                ? "No stock on hand — this quantity will need fresh production."
                                                : stockCovers
                                                ? `Covered by stock in hand (${num(stockTotalKg)} kg available).`
                                                : `Exceeds stock in hand by ${num(stockShortfallKg)} kg (${num(stockTotalKg)} kg available) — shortfall needs production.`}
                                        </span>
                                    )}
                                </Field>
                                {sourcing === "Purchase & resell" && (
                                    <Field label="Purchase Rate ₹/Kg">
                                        <Input type="number" value={purchaseRate} onChange={e => setPurchaseRate(e.target.value)} className="h-9 text-sm" />
                                    </Field>
                                )}
                                <Field label={`Variable Cost ₹/Kg${vcOverride === null ? " (live)" : " (override)"}`}>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={vcOverride !== null ? vcOverride : liveVariableCost.toFixed(2)}
                                            onChange={e => setVcOverride(e.target.value)}
                                            className="h-9 text-sm"
                                        />
                                        {vcOverride !== null && (
                                            <Button variant="outline" size="sm" className="h-9 px-2.5 text-[11px]" onClick={() => setVcOverride(null)}>
                                                Use live
                                            </Button>
                                        )}
                                    </div>
                                    {vcOverride === null && sourcing === "Produce in-house" && !hasCostData && (
                                        <span className="text-[11px] text-warning">
                                            No live Mfg Cost for this SKU — showing 0 until you enter an override.
                                        </span>
                                    )}
                                </Field>
                            </CardContent>
                        </Card>

                    </div>

                    {/* ── Deal verdict — the payoff of the calculator, given full-width presence ── */}
                    <Card className="card-elevated py-0 gap-0 overflow-hidden">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Deal Verdict
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-0 pb-0">
                            <div className="flex flex-col lg:flex-row lg:items-stretch">
                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border/60">
                                    <StatTile label="Variable Cost ₹/Kg" value={variableCostIsKnown ? num(animVariableCost) : "No data"} muted={!variableCostIsKnown} />
                                    <StatTile
                                        label="Contribution ₹/Kg"
                                        value={canQuote ? num(animContributionPerKg) : "—"}
                                        negative={canQuote && contributionPerKg < 0}
                                        lead
                                    />
                                    <StatTile label="P/V Ratio" value={canQuote ? `${(animPvRatio * 100).toFixed(1)}%` : "—"} />
                                    <StatTile
                                        label="Total Contribution (deal)"
                                        value={canQuote ? `₹ ${num(animTotalContribution)}` : "—"}
                                        negative={canQuote && totalContribution < 0}
                                        lead
                                    />
                                </div>
                                <div className="flex items-center justify-center px-5 py-4 lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-border/60 bg-muted/20">
                                    <Badge
                                        variant="outline"
                                        className={`w-full justify-center py-2.5 text-xs font-semibold transition-colors duration-500 ease-out motion-reduce:transition-none ${verdictPulsing ? "animate-verdict-pulse" : ""} ${canQuote ? VERDICT_STYLE[verdict] : "bg-muted text-muted-foreground border-border"}`}
                                    >
                                        {canQuote ? VERDICT_LABEL[verdict] : "Enter Rate/Mt to see verdict"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-x-8 gap-y-1.5 px-4 py-3 border-t border-border/60 text-xs">
                                <span className="text-muted-foreground">
                                    Floor SP (do not quote below): <span className={`font-medium tabular-nums ${variableCostIsKnown ? "text-foreground" : ""}`}>{variableCostIsKnown ? num(animFloorSp) : "No data"}</span>
                                </span>
                                <span className="text-muted-foreground">
                                    SP for 15% margin: <span className={`font-medium tabular-nums ${variableCostIsKnown ? "text-foreground" : ""}`}>{variableCostIsKnown ? num(animSpFor15) : "No data"}</span>
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

/** Label sits beside its control instead of stacked above it, to keep each field to one row. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-snug">{label}</span>
            <div className="flex-1 min-w-0 flex flex-col gap-1">{children}</div>
        </label>
    );
}

function Row({ label, value, emphasize, negative, muted }: { label: string; value: string; emphasize?: boolean; negative?: boolean; muted?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className={`tabular-nums ${emphasize ? "font-semibold text-base" : "font-medium"} ${negative ? "text-destructive" : muted ? "text-muted-foreground" : emphasize ? "text-primary" : "text-foreground"}`}>
                {value}
            </span>
        </div>
    );
}

/** Stat tile for the Deal Verdict band — mirrors the app's StatStrip visual language. */
function StatTile({ label, value, negative, muted, lead }: { label: string; value: string; negative?: boolean; muted?: boolean; lead?: boolean }) {
    return (
        <div className={`bg-card px-4 py-3.5 flex flex-col justify-between gap-1.5 min-w-0 ${lead ? "bg-primary/[0.05]" : ""}`}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{label}</span>
            <span className={`font-display font-semibold tabular-nums truncate ${lead ? "text-xl" : "text-base"} ${negative ? "text-destructive" : muted ? "text-muted-foreground" : lead ? "text-primary" : "text-foreground"}`}>
                {value}
            </span>
        </div>
    );
}
