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
    qty: number | null;
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

export interface QuoteBuilderSkuOption {
    code: number;
    product_name: string;
}

/** One expense line behind a rate-card component (amount for the month, and ₹ per kg of RM consumed). */
export interface RateCardItem {
    particular: string;
    amount: number;
    per_kg: number;
    /** False when the month's direct expenses have no row for this particular (counted as 0). */
    present: boolean;
}

export interface RateCardComponent {
    total: number;
    per_kg: number;
    items: RateCardItem[];
}

/** The month's PMC rate card, computed live from that month's consumption and direct expenses. */
export interface QuoteRateCard {
    fy: string;
    month: string;
    status: "complete" | "missing_consumption" | "missing_expenses";
    /** True when the selected FY had no complete month and an older FY's rates were used. */
    fy_fallback: boolean;
    rm: {
        qty: number;
        /** Consumed value with resold RM taken out at average cost. */
        value: number;
        rate_base: number;
        yield: number;
        wastage_pct: number;
        wastage_per_kg: number;
        /** Yield + wastage on top of rate_base (price − rate_base). */
        uplift_per_kg: number;
        price: number;
        /** The Consumption page's rate (resold RM at the upload file's rate), for reference. */
        consumption_page_rate: number;
        resold: {
            material: string;
            qty: number;
            avg_cost_per_kg: number;
            value_at_cost: number;
            value_in_file: number;
        }[];
    };
    yarn: RateCardComponent;
    fabric_overheads: RateCardComponent & { finance_total: number; finance_per_kg: number };
    missing_particulars: string[];
}

export interface QuoteFabricator {
    status: "ok" | "rate_zero" | "rate_blank" | "no_wtmt";
    rate_per_mt: number | null;
    mts_per_kg: number;
    base_per_kg: number;
    increase_per_kg: number;
    per_kg: number;
}

export interface QuoteCostWarning {
    code: string;
    level: "warning" | "info";
    message: string;
}

export interface QuoteBuilderSku {
    code: number;
    product_name: string;
    mts_per_kg: number | null;
    month: string | null;
    mfg_cost_per_kg: number;
    hist_avg_sp_per_kg: number;
    hist_purchase_rate_per_kg: number;
    has_cost_data: boolean;
    rm_price: number | null;
    yarn_conversion: number | null;
    fabric_addon: number | null;
    fabricator_cost: number | null;
    has_breakdown: boolean;
    /** FY of the rate-card month in `month` (RM, yarn, fabric add-on). */
    fy?: string | null;
    /** Older FY tables store yarn conversion + fabric add-on as one figure (in `yarn_conversion`). */
    conversion_combined?: boolean;
    /** Rate/Mt from the product spec; null when no rate is on file. */
    fab_charge_per_mt?: number | null;
    fab_rate_increase?: number;
    rate_card?: QuoteRateCard | null;
    fabricator?: QuoteFabricator;
    /** False when Mfg Cost is missing or understated (no Wt/Mt, blank fab rate, missing expense rows). */
    cost_complete?: boolean;
    cost_warnings?: QuoteCostWarning[];
    has_sales_history?: boolean;
    sales_fy?: string | null;
    sales_month?: string | null;
}

export interface QuoteBuilderStockRow {
    location: string;
    bales: number;
    qty_kgs: number;
    as_of_date: string;
}

// Uploaded Bale Stock report — parsed server-side, held only in the browser session.
export interface BaleStockRow {
    bale_no: string;
    item: string;
    qty_kgs: number;
    qty_mts: number;
    location: string;
    mixed: boolean;
}

export interface BaleStockLocation {
    name: string;
    full_name: string;
    bales: number;
    lines: number;
    qty_kgs: number;
    qty_mts: number;
}

export interface BaleStockReport {
    file_name: string;
    as_of: string | null;
    rows: BaleStockRow[];
    locations: BaleStockLocation[];
    total_bales: number;
    total_kgs: number;
    total_mts: number;
    warnings: string[];
}
