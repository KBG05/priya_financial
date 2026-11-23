import { useMemo, useRef, useState } from "react";
import { UploadCloud, Loader2, X, XCircle, AlertTriangle, Search, PackageSearch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import type { BaleStockReport as Report } from "@/types";

/**
 * Bale-wise stock from the latest uploaded Bale Stock report.
 *
 * The file is parsed in memory by the backend and the result is kept only in
 * this browser tab (sessionStorage), so it survives switching dashboard tabs
 * but is never written to the database. A successful upload replaces the
 * previous report; a failed upload leaves the previous report in place.
 */

const STORAGE_KEY = "quoteBuilder.baleStockReport";
const MAX_BYTES = 15 * 1024 * 1024;
const RENDER_LIMIT = 500;

function loadStored(): { report: Report; uploadedAt: string } | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed?.report?.rows) ? parsed : null;
    } catch {
        return null;
    }
}

function store(value: { report: Report; uploadedAt: string } | null) {
    try {
        if (value) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Storage full or blocked — the report still shows until the page is left.
    }
}

/** Case/space/punctuation-insensitive key, so "lotus 54" matches LOTUS54"SKY BLUE. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** 'Lotus 54" Sky Blue' → 'Lotus 54"' — the product + width part the bale item names start with. */
function skuSearchTerm(productName: string): string {
    const i = productName.indexOf('"');
    return (i > 0 ? productName.slice(0, i + 1) : productName).trim();
}

function num(v: number, digits = 2): string {
    if (v == null || isNaN(v)) return "—";
    return v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function BaleStockReport({ skuName }: { skuName?: string | null }) {
    const initial = useMemo(loadStored, []);
    const [report, setReport] = useState<Report | null>(initial?.report ?? null);
    const [uploadedAt, setUploadedAt] = useState<string | null>(initial?.uploadedAt ?? null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<string>("__all__");
    const [search, setSearch] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleFile(file: File | undefined) {
        if (inputRef.current) inputRef.current.value = ""; // allow re-selecting the same file
        if (!file) return;
        setError(null);
        if (!/\.(xls|xlsx)$/i.test(file.name)) {
            setError("Unsupported file type. Upload the Bale Stock report as .xls or .xlsx.");
            return;
        }
        if (file.size === 0) { setError("The selected file is empty."); return; }
        if (file.size > MAX_BYTES) { setError("File is too large (max 15 MB)."); return; }

        setUploading(true);
        try {
            const parsed = await api.parseBaleStock(file);
            const at = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            setReport(parsed);
            setUploadedAt(at);
            setLocation("__all__");
            store({ report: parsed, uploadedAt: at });
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    function clearReport() {
        setReport(null);
        setUploadedAt(null);
        setError(null);
        setSearch("");
        setLocation("__all__");
        store(null);
    }

    const filtered = useMemo(() => {
        if (!report) return [];
        const q = norm(search);
        return report.rows.filter(r =>
            (location === "__all__" || r.location === location) &&
            (!q || norm(r.item).includes(q) || norm(r.bale_no).includes(q) ||
                norm(r.description ?? "").includes(q) || (r.code != null && String(r.code) === q))
        );
    }, [report, location, search]);

    const filteredKgs = filtered.reduce((s, r) => s + (r.qty_kgs ?? 0), 0);
    const filteredMts = filtered.reduce((s, r) => s + (r.qty_mts ?? 0), 0);
    const filteredBales = useMemo(() => new Set(filtered.map(r => `${r.location}|${r.bale_no}`)).size, [filtered]);
    const skuTerm = skuName ? skuSearchTerm(skuName) : "";

    return (
        <Card className="card-elevated py-0 gap-0">
            <CardHeader className="py-3 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Bale stock — uploaded report
                        </CardTitle>
                        {report && (
                            <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                {report.as_of ? `As on ${report.as_of}` : "Date not found in report"}
                                {" · "}{report.file_name}
                                {uploadedAt ? ` · uploaded ${uploadedAt}` : ""}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xls,.xlsx"
                            className="hidden"
                            onChange={e => handleFile(e.target.files?.[0])}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            disabled={uploading}
                            onClick={() => inputRef.current?.click()}
                        >
                            {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                            {uploading ? "Processing…" : report ? "Upload new report" : "Upload report"}
                        </Button>
                        {report && !uploading && (
                            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearReport}>
                                <X size={13} /> Clear
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 flex flex-col gap-3 text-sm">
                {error && (
                    <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2.5 py-2">
                        <XCircle size={13} className="shrink-0 mt-0.5" />
                        <span className="flex-1">
                            {error}
                            {report && " The previously uploaded report is still shown."}
                        </span>
                        <button onClick={() => setError(null)} className="hover:opacity-70" aria-label="Dismiss error">
                            <X size={12} />
                        </button>
                    </div>
                )}

                {report?.warnings.map(w => (
                    <p key={w} className="flex items-start gap-1.5 text-xs text-warning bg-warning/10 rounded-md px-2 py-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        {w}
                    </p>
                ))}

                {!report ? (
                    <div className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border/70 py-8 px-4 text-center">
                        <PackageSearch size={20} className="text-muted-foreground" />
                        <span className="text-sm text-foreground">No bale stock report uploaded</span>
                        <span className="text-xs text-muted-foreground max-w-md">
                            Upload the latest Bale Stock report (.xls or .xlsx) to see bale-wise stock by location.
                            It is processed on the fly and not saved — upload again whenever stock changes.
                        </span>
                    </div>
                ) : (
                    <>
                        {/* Location summary — doubles as the location filter */}
                        <div className="flex flex-wrap gap-2">
                            {[{ name: "__all__", label: "All locations", bales: report.total_bales, kgs: report.total_kgs, title: undefined as string | undefined },
                              ...report.locations.map(l => ({ name: l.name, label: l.name, bales: l.bales, kgs: l.qty_kgs, title: l.full_name }))]
                                .map(l => (
                                    <button
                                        key={l.name}
                                        type="button"
                                        title={l.title}
                                        onClick={() => setLocation(l.name)}
                                        className={`flex flex-col items-start rounded-md border px-3 py-1.5 text-left transition-colors ${location === l.name
                                            ? "border-primary/50 bg-primary/10"
                                            : "border-border/60 bg-background hover:bg-muted/50"}`}
                                    >
                                        <span className={`text-[10px] font-semibold uppercase tracking-wider ${location === l.name ? "text-primary" : "text-muted-foreground"}`}>
                                            {l.label}
                                        </span>
                                        <span className="text-xs tabular-nums text-foreground">
                                            {l.bales.toLocaleString("en-IN")} bales · {num(l.kgs)} kg
                                        </span>
                                    </button>
                                ))}
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="relative w-full sm:max-w-sm">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search bale no, item or code…"
                                    className="h-9 pl-9 pr-8 text-sm"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        aria-label="Clear search"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            {skuTerm && norm(search) !== norm(skuTerm) && (
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSearch(skuTerm)}>
                                    Show bales matching “{skuTerm}”
                                </Button>
                            )}
                        </div>

                        {filtered.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-1 py-3">No bales match the current filter.</p>
                        ) : (
                            <div className="rounded-md border border-border/50 overflow-auto max-h-[460px]">
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                                            <th className="text-left font-semibold px-2.5 py-1.5">Bale No</th>
                                            <th className="text-left font-semibold px-2.5 py-1.5">Item</th>
                                            <th className="text-left font-semibold px-2.5 py-1.5">Location</th>
                                            <th className="text-right font-semibold px-2.5 py-1.5">Qty Kgs</th>
                                            <th className="text-right font-semibold px-2.5 py-1.5">Qty Mts</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.slice(0, RENDER_LIMIT).map((r, i) => (
                                            <tr key={`${r.location}|${r.bale_no}|${r.item}|${i}`} className="border-t border-border/30">
                                                <td className="px-2.5 py-1.5 text-foreground tabular-nums whitespace-nowrap">
                                                    {r.bale_no}
                                                    {r.mixed && (
                                                        <Badge variant="outline" className="ml-1.5 px-1 py-0 text-[9px] font-medium text-muted-foreground">
                                                            Mixed
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-2.5 py-1.5 text-foreground">{r.item}</td>
                                                <td className="px-2.5 py-1.5 text-muted-foreground whitespace-nowrap">{r.location}</td>
                                                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{num(r.qty_kgs)}</td>
                                                <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{num(r.qty_mts, 0)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="sticky bottom-0">
                                        <tr className="border-t border-border/60 bg-muted">
                                            <td className="px-2.5 py-1.5 font-semibold text-foreground" colSpan={3}>
                                                Total — {filteredBales.toLocaleString("en-IN")} bales
                                                {filtered.length > RENDER_LIMIT && (
                                                    <span className="font-normal text-muted-foreground">
                                                        {" "}(showing first {RENDER_LIMIT} of {filtered.length.toLocaleString("en-IN")} lines — search to narrow)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-primary">{num(filteredKgs)}</td>
                                            <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold text-primary">{num(filteredMts, 0)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
