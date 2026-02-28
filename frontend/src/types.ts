// TypeScript interfaces matching the API response shapes

export const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;
export type Month = typeof MONTH_ORDER[number];

export type ViewMode = "single" | "quarterly" | "mty-all";

export interface Pal1Row {
    month: string;
    line_item: string;
    qty: number | null;
    value: number | null;
    rate: number | null;
}

export interface MtyRow {
    month: string;
    line_item: string;
    value: number | null;
}

export interface ConsumptionRow {
    month: string;
    material: string;
    opening_stock_qty: number;
    opening_stock_value: number;
    purchases_qty: number;
    purchases_value: number;
    sales_qty: number;
    sales_value: number;
    closing_stock_qty: number;
    closing_stock_value: number;
    qty: number;
    value: number;
    rate: number | null;
}

export interface KpiRow {
    month: string;
    kpi_name: string;
    value: number | null;
}

export interface DirectExpRow {
    month: string;
    category: string;
    line_item: string;
    value: number | null;
}

// KPIs that show % symbol
export const KPI_PCT = new Set(["Revenue growth", "Gross margin", "EBITDA", "Net Margin"]);
// KPIs that show ₹ symbol
export const KPI_RUPEE = new Set(["EV (Enterprise Value)"]);
