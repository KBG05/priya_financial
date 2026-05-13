import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import type { ViewMode } from "@/types";
import { MONTH_ORDER } from "@/types";
import { Separator } from "@/components/ui/separator";

const QUARTERS: Record<string, string[]> = {
    "Q1 (Apr–Jun)": ["Apr", "May", "Jun"],
    "Q2 (Jul–Sep)": ["Jul", "Aug", "Sep"],
    "Q3 (Oct–Dec)": ["Oct", "Nov", "Dec"],
    "Q4 (Jan–Mar)": ["Jan", "Feb", "Mar"],
};

interface FilterBarProps {
    availableMonths: string[];
    availableFYs: string[];
    fy: string;
    viewMode: ViewMode;
    selectedMonths: string[];
    onFyChange: (fy: string) => void;
    onViewModeChange: (vm: ViewMode) => void;
    onMonthsChange: (months: string[]) => void;
}

export function FilterBar({
    availableMonths, availableFYs, fy, viewMode, selectedMonths,
    onFyChange, onViewModeChange, onMonthsChange,
}: FilterBarProps) {
    const curMonth = selectedMonths[selectedMonths.length - 1] ?? availableMonths[availableMonths.length - 1];

    const handleViewModeChange = (v: string) => {
        const vm = v as ViewMode;
        onViewModeChange(vm);
        const last = availableMonths[availableMonths.length - 1];
        if (vm === "single") {
            onMonthsChange([last]);
        } else if (vm === "quarterly") {
            const idx = availableMonths.indexOf(last);
            onMonthsChange(availableMonths.slice(Math.max(0, idx - 2), idx + 1));
        } else {
            // mty-all: pass every available month
            onMonthsChange([...availableMonths]);
        }
    };

    const toggleCustomMonth = (m: string) => {
        if (selectedMonths.includes(m)) {
            if (selectedMonths.length > 1) onMonthsChange(selectedMonths.filter(x => x !== m));
        } else {
            if (selectedMonths.length < 3) {
                onMonthsChange(MONTH_ORDER.filter(mo => [...selectedMonths, m].includes(mo)));
            }
        }
    };

    // Shared SelectContent props — always open downward (popper anchors below, no flip)
    const scProps = {
        side: "bottom" as const,
        align: "start" as const,
        avoidCollisions: false,
        position: "popper" as const,
        className: "bg-popover border border-border z-50",
    };

    return (
        <div className="flex flex-wrap items-end gap-3 p-4 bg-card card-elevated rounded-xl">
            {/* Fiscal Year — always visible */}
            <>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fiscal Year</label>
                    <Select value={fy} onValueChange={onFyChange}>
                        <SelectTrigger className="w-28 h-8 bg-background border-border text-sm font-semibold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent {...scProps}>
                            {availableFYs.map(f => (
                                <SelectItem key={f} value={f}>
                                    FY {f.replace("_", "-")}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <Separator orientation="vertical" className="h-9 self-end mb-0.5 opacity-30 hidden sm:block" />
            </>
            {/* View Mode */}
            <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">View</label>
                <Select value={viewMode} onValueChange={handleViewModeChange}>
                    <SelectTrigger className="w-40 h-8 bg-background border-border text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent {...scProps}>
                        <SelectItem value="single">Single Month</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="mty-all">All Months</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Separator orientation="vertical" className="h-9 self-end mb-0.5 opacity-30 hidden sm:block" />

            {/* Single month picker */}
            {viewMode === "single" && (
                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Month</label>
                    <Select value={curMonth} onValueChange={m => onMonthsChange([m])}>
                        <SelectTrigger className="w-28 h-8 bg-background border-border text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent {...scProps}>
                            {availableMonths.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Quarterly: preset + custom */}
            {viewMode === "quarterly" && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preset</label>
                        <Select value="" onValueChange={q => onMonthsChange(QUARTERS[q].filter(m => availableMonths.includes(m)))}>
                            <SelectTrigger className="w-36 h-8 bg-background border-border text-sm">
                                <SelectValue placeholder="Quarter…" />
                            </SelectTrigger>
                            <SelectContent {...scProps}>
                                {Object.keys(QUARTERS).map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Custom (≤ 3)</label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-8 min-w-35 justify-between bg-background border-border font-normal text-sm px-3 gap-1.5">
                                    <span className="flex gap-1 flex-wrap max-w-25 overflow-hidden">
                                        {selectedMonths.length > 0
                                            ? selectedMonths.map(m => <Badge key={m} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/15 text-primary border-0">{m}</Badge>)
                                            : <span className="text-muted-foreground">Pick…</span>}
                                    </span>
                                    <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="bottom" align="start" avoidCollisions={false} className="w-34 bg-popover border border-border z-50">
                                {availableMonths.map(m => (
                                    <DropdownMenuCheckboxItem
                                        key={m} checked={selectedMonths.includes(m)}
                                        onCheckedChange={() => toggleCustomMonth(m)}
                                        disabled={!selectedMonths.includes(m) && selectedMonths.length >= 3}
                                        className="text-sm"
                                    >{m}</DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </>
            )}

            {/* MTY All Months: no month picker — all available months shown */}
            {viewMode === "mty-all" && (
                <div className="flex items-end pb-1">
                    <span className="text-xs text-muted-foreground font-medium">
                        Showing all {availableMonths.length} month{availableMonths.length !== 1 ? "s" : ""}
                    </span>
                </div>
            )}
        </div>
    );
}
