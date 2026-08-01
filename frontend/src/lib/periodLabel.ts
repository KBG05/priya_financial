import { MONTH_ORDER } from "@/types";
import type { ViewMode } from "@/types";

const FULL_MONTH: Record<string, string> = {
    Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September",
    Oct: "October", Nov: "November", Dec: "December", Jan: "January", Feb: "February", Mar: "March",
};

const QUARTER_OF: Record<string, { label: string; range: string }> = {
    Apr: { label: "Q1", range: "Apr–Jun" }, May: { label: "Q1", range: "Apr–Jun" }, Jun: { label: "Q1", range: "Apr–Jun" },
    Jul: { label: "Q2", range: "Jul–Sep" }, Aug: { label: "Q2", range: "Jul–Sep" }, Sep: { label: "Q2", range: "Jul–Sep" },
    Oct: { label: "Q3", range: "Oct–Dec" }, Nov: { label: "Q3", range: "Oct–Dec" }, Dec: { label: "Q3", range: "Oct–Dec" },
    Jan: { label: "Q4", range: "Jan–Mar" }, Feb: { label: "Q4", range: "Jan–Mar" }, Mar: { label: "Q4", range: "Jan–Mar" },
};

/** fy is a two-year suffix like "25_26" — Apr–Dec fall in the first year, Jan–Mar in the second */
function calendarYear(fy: string, month: string): string {
    const [y1, y2] = fy.split("_");
    if (!y1) return "";
    return ["Jan", "Feb", "Mar"].includes(month) ? `20${y2}` : `20${y1}`;
}

/** Human headline for the currently-selected period, e.g. "FY 25-26 · March 2026" or "FY 25-26 · Q4 (Jan–Mar)" */
export function periodLabel(fy: string, viewMode: ViewMode, months: string[]): string {
    if (!fy || months.length === 0) return "";
    const fyLabel = `FY ${fy.replace("_", "-")}`;

    if (viewMode === "single") {
        const m = months[0];
        return `${fyLabel} · ${FULL_MONTH[m] ?? m} ${calendarYear(fy, m)}`;
    }
    if (viewMode === "mty-all") {
        return `${fyLabel} · Full Year (Apr–Mar)`;
    }

    const sorted = [...months].sort((a, b) => MONTH_ORDER.indexOf(a as any) - MONTH_ORDER.indexOf(b as any));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const q = QUARTER_OF[last];
    const isStandardQuarter = sorted.length === 3 && q && QUARTER_OF[first]?.label === q.label;
    if (isStandardQuarter) {
        return `${fyLabel} · ${q.label} (${q.range})`;
    }
    return `${fyLabel} · ${sorted.join(", ")}`;
}
