import { useEffect, useMemo, useState } from "react";
import { Search, X, RotateCcw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/api";
import { fmt } from "@/lib/format";
import type { QuoteBuilderSku, QuoteBuilderSkuOption, QuoteBuilderStockRow } from "@/types";

interface Props { fy?: string; }

type Sourcing = "Produce in-house" | "Purchase & resell";

type Verdict = "REJECT" | "CAUTION" | "ACCEPTABLE" | "STRONG";

const VERDICT_STYLE: Record<Verdict, string> = {
    REJECT: "bg-destructive/15 text-destructive border-destructive/40",
    CAUTION: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40",
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

export function QuoteBuilderPage({ fy }: Props) {
    const [skuOptions, setSkuOptions] = useState<QuoteBuilderSkuOption[]>([]);
    const [skuSearch, setSkuSearch] = useState("");
    const [skuOpen, setSkuOpen] = useState(false);
    const [selectedCode, setSelectedCode] = useState<number | null>(null);

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
        api.quoteBuilderSkus(fy).then(r => setSkuOptions(r.data)).catch(() => setSkuOptions([]));
    }, [fy]);

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

    const liveVariableCost = sourcing === "Produce in-house"
        ? (sku?.mfg_cost_per_kg ?? 0)
        : purchRate;
    const variableCost = vcOverride !== null ? (parseFloat(vcOverride) || 0) : liveVariableCost;

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

    const selectedOption = skuOptions.find(o => o.code === selectedCode);

    function resetDeal() {
        setRatePerMt("");
        setProposedQty("1");
        setVcOverride(null);
        setSourcing("Produce in-house");
        if (sku) setPurchaseRate(String(sku.hist_purchase_rate_per_kg ?? 0));
    }

    return (
        <div className="flex flex-col gap-3 min-w-0 w-full">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Quote Builder</h2>
                    <p className="text-xs text-muted-foreground">Price a single deal against live PMC costing.</p>
                </div>
                {sku && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={resetDeal}>
                        <RotateCcw size={12} /> Reset deal terms
                    </Button>
                )}
            </div>

            {/* ── SKU picker ── */}
            <Card className="card-elevated">
                <CardContent className="p-4">
                    <div className="relative w-full max-w-md">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                            value={skuOpen ? skuSearch : (selectedOption ? `${selectedOption.code} — ${selectedOption.product_name}` : skuSearch)}
                            onChange={e => { setSkuSearch(e.target.value); setSkuOpen(true); }}
                            onFocus={() => { setSkuOpen(true); setSkuSearch(""); }}
                            placeholder="Search SKU code or product name…"
                            className="h-9 pl-8 pr-7 text-sm"
                        />
                        {selectedOption && !skuOpen && (
                            <button
                                onClick={() => { setSelectedCode(null); setSkuSearch(""); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X size={13} />
                            </button>
                        )}
                        {skuOpen && (
                            <div className="absolute z-40 mt-1 w-full max-h-72 overflow-auto rounded-md border border-border bg-popover shadow-md">
                                {filteredSkus.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">No matching SKUs.</div>
                                ) : filteredSkus.map(o => (
                                    <button
                                        key={o.code}
                                        onClick={() => { setSelectedCode(o.code); setSkuOpen(false); setSkuSearch(""); }}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 flex items-center gap-2"
                                    >
                                        <span className="text-muted-foreground w-10 shrink-0 tabular-nums">{o.code}</span>
                                        <span className="text-foreground">{o.product_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {skuOpen && (
                            <div className="fixed inset-0 z-30" onClick={() => setSkuOpen(false)} />
                        )}
                    </div>
                </CardContent>
            </Card>

            {selectedCode == null && (
                <p className="text-sm text-muted-foreground px-1">Pick a SKU above to start pricing a deal.</p>
            )}

            {skuLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Skeleton className="h-56" />
                    <Skeleton className="h-56" />
                </div>
            )}

            {!skuLoading && sku && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* ── Auto-filled SKU info ── */}
                    <Card className="card-elevated">
                        <CardHeader className="py-2 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                SKU — {sku.code}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 flex flex-col gap-2 text-xs">
                            <div className="font-semibold text-sm text-foreground">{sku.product_name}</div>
                            {skuWarning && <p className="text-amber-600 dark:text-amber-400">{skuWarning}</p>}
                            <Row label="Mfg Cost ₹/Kg (live)" value={fmt(sku.mfg_cost_per_kg)} />
                            <Row label="Hist Purchase Rate ₹/Kg" value={fmt(sku.hist_purchase_rate_per_kg)} />
                            <Row label="Hist Avg SP ₹/Kg" value={fmt(sku.hist_avg_sp_per_kg)} />
                            <Row
                                label="Wt/Mt"
                                value={wtPerMt ? `${wtPerMt.toFixed(4)} kg/m (≈ ${sku.mts_per_kg?.toFixed(2)} m/kg)` : "—"}
                            />
                            {sku.month && (
                                <span className="text-[10px] text-muted-foreground mt-1">Costing basis: {sku.month}</span>
                            )}
                            <div className="mt-2 pt-2 border-t border-border/30">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stock in hand</span>
                                    {stock.length > 0 && (
                                        <span className="text-[10px] text-muted-foreground">
                                            as of {stock[0].as_of_date}
                                        </span>
                                    )}
                                </div>
                                {stock.length === 0 ? (
                                    <span className="text-muted-foreground">No stock snapshot for this SKU — likely zero on hand at last count.</span>
                                ) : (
                                    <>
                                        {stock.map(s => (
                                            <Row
                                                key={s.location}
                                                label={s.location}
                                                value={`${fmt(s.bales)} bales · ${fmt(s.qty_kgs)} kg`}
                                            />
                                        ))}
                                        <Row
                                            label="Total across units"
                                            value={`${fmt(stockTotalBales)} bales · ${fmt(stockTotalKg)} kg`}
                                            emphasize
                                        />
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* ── Deal terms ── */}
                    <Card className="card-elevated">
                        <CardHeader className="py-2 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Deal Terms
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 flex flex-col gap-3 text-xs">
                            <Field label="Sourcing">
                                <Select value={sourcing} onValueChange={v => setSourcing(v as Sourcing)}>
                                    <SelectTrigger size="sm" className="w-full h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Produce in-house">Produce in-house</SelectItem>
                                        <SelectItem value="Purchase & resell">Purchase & resell</SelectItem>
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field label="Rate per Mt (₹/Metre)">
                                <Input type="number" value={ratePerMt} onChange={e => setRatePerMt(e.target.value)} className="h-8 text-xs" placeholder="0.00" />
                                {ratePerKgHint > 0 && (
                                    <span className="text-[10px] text-muted-foreground">
                                        ≈ ₹{ratePerKgHint.toFixed(2)}/kg at this SKU's Wt/Mt
                                    </span>
                                )}
                            </Field>
                            <Field label="Proposed Sale Price ₹/Kg (auto)">
                                <div className="h-8 flex items-center px-2 rounded-md border border-border/50 bg-muted/30 font-semibold tabular-nums">
                                    {wtPerMt > 0 ? fmt(proposedSalePrice) : "— set Rate/Mt"}
                                </div>
                            </Field>
                            {wtPerRoll > 0 && (
                                <Row label="Wt/Roll (kg)" value={wtPerRoll.toFixed(2)} />
                            )}
                            <Field label="Proposed Quantity (Kgs)">
                                <Input type="number" value={proposedQty} onChange={e => setProposedQty(e.target.value)} className="h-8 text-xs" />
                                {qty > 0 && (
                                    <span className={`flex items-center gap-1 text-[10px] ${stockCovers ? "text-primary" : "text-amber-600 dark:text-amber-400"}`}>
                                        {stockCovers ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                        {stockTotalKg <= 0
                                            ? "No stock on hand — this quantity will need fresh production."
                                            : stockCovers
                                            ? `Covered by stock in hand (${fmt(stockTotalKg)} kg available).`
                                            : `Exceeds stock in hand by ${fmt(stockShortfallKg)} kg (${fmt(stockTotalKg)} kg available) — shortfall needs production.`}
                                    </span>
                                )}
                            </Field>
                            {sourcing === "Purchase & resell" && (
                                <Field label="Purchase Rate ₹/Kg">
                                    <Input type="number" value={purchaseRate} onChange={e => setPurchaseRate(e.target.value)} className="h-8 text-xs" />
                                </Field>
                            )}
                            <Field label={`Variable Cost ₹/Kg${vcOverride === null ? " (live)" : " (override)"}`}>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={vcOverride !== null ? vcOverride : liveVariableCost.toFixed(2)}
                                        onChange={e => setVcOverride(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                    {vcOverride !== null && (
                                        <Button variant="outline" size="sm" className="h-8 px-2 text-[10px]" onClick={() => setVcOverride(null)}>
                                            Use live
                                        </Button>
                                    )}
                                </div>
                            </Field>
                        </CardContent>
                    </Card>

                    {/* ── Results ── */}
                    <Card className="card-elevated">
                        <CardHeader className="py-2 px-4">
                            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Results
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 flex flex-col gap-2 text-xs">
                            <Row label="Variable Cost ₹/Kg" value={fmt(variableCost)} />
                            <Row
                                label="Contribution ₹/Kg"
                                value={fmt(contributionPerKg)}
                                emphasize
                                negative={contributionPerKg < 0}
                            />
                            <Row label="P/V Ratio" value={`${(pvRatio * 100).toFixed(1)}%`} />
                            <Row
                                label="Total Contribution (deal)"
                                value={fmt(totalContribution, { rupee: true })}
                                emphasize
                                negative={totalContribution < 0}
                            />
                            <div className="mt-1 pt-2 border-t border-border/30 flex flex-col gap-2">
                                <Row label="Floor SP (do not quote below)" value={fmt(floorSp)} />
                                <Row label="SP for 15% margin" value={fmt(spFor15)} />
                            </div>
                            <div className="mt-2">
                                <Badge variant="outline" className={`w-full justify-center py-1.5 text-[11px] font-semibold ${VERDICT_STYLE[verdict]}`}>
                                    {VERDICT_LABEL[verdict]}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
            {children}
        </label>
    );
}

function Row({ label, value, emphasize, negative }: { label: string; value: string; emphasize?: boolean; negative?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{label}</span>
            <span className={`tabular-nums ${emphasize ? "font-semibold text-sm" : "font-medium"} ${negative ? "text-destructive" : emphasize ? "text-primary" : "text-foreground"}`}>
                {value}
            </span>
        </div>
    );
}
