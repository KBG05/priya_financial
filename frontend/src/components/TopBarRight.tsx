import { Moon, Sun, Monitor, UploadCloud, Info, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/useTheme";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState, useRef, useMemo } from "react";
import { api } from "@/api";

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

interface Props {
    availableMonths: string[];
    fy: string;
    availableFYs: string[];
}

// Small helper: label + info icon tooltip
function FieldLabel({ label, info }: { label: string; info: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info size={12} className="text-muted-foreground/60 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-64 text-xs leading-relaxed">
                        {info}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

// File picker row
function FilePicker({ id, onChange, file }: { id: string; onChange: (f: File | null) => void; file: File | null }) {
    const ref = useRef<HTMLInputElement>(null);
    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={() => ref.current?.click()}
                className="h-8 px-3 text-xs rounded-md border border-border bg-background hover:bg-muted transition-colors truncate max-w-52 text-left"
            >
                {file ? file.name : "Choose file…"}
            </button>
            {file && (
                <button type="button" onClick={() => { onChange(null); if (ref.current) ref.current.value = ""; }}
                    className="text-muted-foreground hover:text-destructive text-xs">✕</button>
            )}
            <input ref={ref} id={id} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={e => onChange(e.target.files?.[0] ?? null)} />
        </div>
    );
}

// Toggle between two choices
function TogglePair({ value, options, onChange }: {
    value: string;
    options: [string, string];
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-medium">
            {options.map(opt => (
                <button
                    key={opt}
                    type="button"
                    onClick={() => onChange(opt)}
                    className={`px-3 py-1.5 transition-colors ${value === opt
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                >{opt}</button>
            ))}
        </div>
    );
}

/** Given "25_26" returns "26_27" */
function nextFySuffix(suffix: string): string {
    const [, b] = suffix.split("_");
    const y = parseInt(b ?? "26", 10);
    return `${y}_${y + 1}`;
}

export function TopBarRight({ fy, availableFYs }: Props) {
    const { theme, setTheme } = useTheme();
    const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

    // Always include existing FYs + the next two future FYs so a user can
    // upload data for a year that doesn't exist in the DB yet.
    const uploadFyOptions: string[] = useMemo(() => {
        const base = availableFYs.length ? availableFYs : [fy || "25_26"];
        const sorted = [...new Set(base)].sort();
        const last = sorted[sorted.length - 1] ?? (fy || "25_26");
        const n1 = nextFySuffix(last);
        const n2 = nextFySuffix(n1);
        const extended = [...new Set([...sorted, n1, n2])];
        return extended;
    }, [availableFYs, fy]);

    // ── Upload state ──────────────────────────────────────────────────────
    const [open, setOpen] = useState(false);

    // Section 1: Core financials
    const [coreMode, setCoreMode] = useState<"MIS File" | "Sales & Exp File">("MIS File");
    const [coreFile, setCoreFile] = useState<File | null>(null);

    // Section 2: Balance sheet
    const [balMode, setBalMode] = useState<"Same as core" | "Separate file">("Same as core");
    const [balFile, setBalFile] = useState<File | null>(null);

    // Section 3: Salary (optional)
    const [salaryFile, setSalaryFile] = useState<File | null>(null);

    // Section 4: Item sales / contribution (optional)
    const [itemSalesFile, setItemSalesFile] = useState<File | null>(null);

    // Config
    const [selectedFy, setSelectedFy] = useState(fy);
    const [selectedMonth, setSelectedMonth] = useState<string>("__all__");
    const [replaceExisting, setReplaceExisting] = useState(false);

    // Status
    const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
    const [logs, setLogs] = useState("");

    const busy = status === "running";

    const handleSubmit = async () => {
        if (!coreFile) return;
        setStatus("running");
        setLogs("");
        try {
            const balanceFile = balMode === "Same as core" ? coreFile : balFile;
            const res = await api.uploadAndProcess({
                coreFile,
                balanceFile,
                salaryFile,
                itemSalesFile,
                fy: selectedFy,
                months: selectedMonth === "__all__" ? "" : selectedMonth,
                replaceExisting,
            });
            setLogs(res.logs + (res.error ? `\n\nError: ${res.error}` : ""));
            setStatus(res.ok ? "ok" : "error");
        } catch (e: any) {
            setLogs(e?.message || "Request failed");
            setStatus("error");
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Upload sheet */}
            <Sheet open={open} onOpenChange={setOpen}>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setOpen(true)}>
                    <UploadCloud size={14} /> Upload & Process
                </Button>

                <SheetContent className="w-105 sm:w-120 flex flex-col gap-0 overflow-y-auto">
                    <SheetHeader className="px-6 pt-6 pb-4">
                        <SheetTitle className="flex items-center gap-2">
                            <UploadCloud size={18} /> Upload & Process
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            Upload Tally export files and run the full ingestion pipeline.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-col gap-5 px-6 pb-6">

                        {/* ── Section 1: Core Financials ────────────────── */}
                        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                            <FieldLabel
                                label="Core Financials"
                                info="Source for Purchases, Inventory Sales, Direct & Indirect Expenses, and Stock Valuation. Upload the MIS Excel (recommended — contains all sheets), OR the individual Sales_Pur_Exps file from Tally."
                            />
                            <TogglePair
                                value={coreMode}
                                options={["MIS File", "Sales & Exp File"]}
                                onChange={v => { setCoreMode(v as any); setCoreFile(null); }}
                            />
                            <FilePicker id="core" file={coreFile} onChange={setCoreFile} />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                {coreMode === "MIS File"
                                    ? 'Upload "8. MIS Nov 25.xlsx" — contains all required sheets.'
                                    : 'Upload "Sales_Pur_Exps-Nov.25.xlsx" — Tally export with Purchase, Inventory Sales, Direct & Indirect Expns, Stock Valuation sheets.'}
                            </p>
                        </div>

                        {/* ── Section 2: Balance Sheet ──────────────────── */}
                        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                            <FieldLabel
                                label="Balance Sheet"
                                info="Required for MTY and KPI calculations. If you uploaded the MIS file above, select 'Same as core' to reuse it. Otherwise upload the BS_PL_CF Tally export (BS_PL_CF-Nov.25.xlsx)."
                            />
                            <TogglePair
                                value={balMode}
                                options={["Same as core", "Separate file"]}
                                onChange={v => { setBalMode(v as any); setBalFile(null); }}
                            />
                            {balMode === "Separate file" && (
                                <>
                                    <FilePicker id="bal" file={balFile} onChange={setBalFile} />
                                    <p className="text-[10px] text-muted-foreground">
                                        Upload "BS_PL_CF-Nov.25.xlsx" (Tally balance sheet export) or MIS file.
                                    </p>
                                </>
                            )}
                            {balMode === "Same as core" && (
                                <p className="text-[10px] text-muted-foreground">
                                    {coreMode === "MIS File"
                                        ? "✓ The MIS file will be used for the Balance Sheet tab."
                                        : "⚠ Core is not a MIS file — balance sheet / KPIs will be skipped."}
                                </p>
                            )}
                        </div>

                        {/* ── Section 3: Salary (optional) ─────────────── */}
                        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                            <FieldLabel
                                label="Salary File (optional)"
                                info={'Monthly salary data by department. Upload "PFCO Nov 25 Salary.xls". If omitted, salary data is skipped and existing salary records are preserved.'}
                            />
                            <FilePicker id="salary" file={salaryFile} onChange={setSalaryFile} />
                        </div>

                        {/* ── Section 4: Item Sales (optional) ─────────── */}
                        <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
                            <FieldLabel
                                label="Latest Item Sales (optional)"
                                info="Product-level monthly sales data used for Contribution analysis. Upload a monthly item-sales Excel file. Requires a specific month to be selected below."
                            />
                            <FilePicker id="item" file={itemSalesFile} onChange={setItemSalesFile} />
                        </div>

                        <Separator />

                        {/* ── Config row ───────────────────────────────── */}
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel label="Fiscal Year" info="Target fiscal year suffix in the database." />
                                <Select value={selectedFy} onValueChange={setSelectedFy}>
                                    <SelectTrigger className="w-28 h-8 text-xs bg-background border-border">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {uploadFyOptions.map(f => (
                                            <SelectItem key={f} value={f} className="text-xs">
                                                FY {f.replace("_", "-")}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <FieldLabel
                                    label="Month Filter"
                                    info="If set, only the selected month is updated; existing months in the DB are preserved. Leave blank to refresh all months in the file."
                                />
                                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                    <SelectTrigger className="w-28 h-8 text-xs bg-background border-border">
                                        <SelectValue placeholder="All months" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__" className="text-xs text-muted-foreground">All months</SelectItem>
                                        {MONTH_ORDER.map(m => (
                                            <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center gap-2 pb-0.5">
                                <input
                                    id="replace"
                                    type="checkbox"
                                    checked={replaceExisting}
                                    onChange={e => setReplaceExisting(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-primary"
                                />
                                <label htmlFor="replace" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                                    Replace existing
                                </label>
                            </div>
                        </div>

                        {/* ── Submit ───────────────────────────────────── */}
                        <Button
                            onClick={handleSubmit}
                            disabled={busy || !coreFile}
                            className="w-full gap-2"
                        >
                            {busy
                                ? <><Loader2 size={14} className="animate-spin" /> Processing…</>
                                : <><UploadCloud size={14} /> Upload & Process</>}
                        </Button>

                        {/* ── Status + logs ────────────────────────────── */}
                        {status !== "idle" && (
                            <div className="rounded-lg border border-border overflow-hidden">
                                <div className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold ${status === "ok" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : status === "error" ? "bg-destructive/10 text-destructive"
                                        : "bg-muted text-muted-foreground"}`}>
                                    {status === "ok" && <CheckCircle2 size={13} />}
                                    {status === "error" && <XCircle size={13} />}
                                    {status === "running" && <Loader2 size={13} className="animate-spin" />}
                                    {status === "ok" ? "Pipeline completed successfully"
                                        : status === "error" ? "Pipeline finished with errors"
                                            : "Running pipeline…"}
                                </div>
                                {logs && (
                                    <pre className="text-[10px] leading-relaxed p-3 bg-muted/20 overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                                        {logs}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Theme toggle */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Icon size={16} />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={() => setTheme("light")}>
                        <Sun size={14} className="mr-2" /> Light
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <Moon size={14} className="mr-2" /> Dark
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTheme("system")}>
                        <Monitor size={14} className="mr-2" /> System
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* User avatar */}
            <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground font-bold">PF</AvatarFallback>
            </Avatar>
        </div>
    );
}
