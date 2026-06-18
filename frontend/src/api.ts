// Parse backend URL from env, fallback to localhost for dev
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(BASE + path);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
    return res.json();
}

export const api = {
    fyList: () => get<{ fy_list: string[]; default: string }>("/fy"),
    months: (fy?: string) => get<{ months: string[] }>("/months", fy ? { fy } : undefined),
    pal1: (months: string[], fy?: string) => get<{ data: any[] }>("/pal1", { months: months.join(","), ...(fy ? { fy } : {}) }),
    mty: (months: string[], fy?: string) => get<{ data: any[] }>("/mty", { months: months.join(","), ...(fy ? { fy } : {}) }),
    consumption: (months: string[], fy?: string) => get<{ data: any[] }>("/consumption", { months: months.join(","), ...(fy ? { fy } : {}) }),
    kpis: (months: string[], fy?: string) => get<{ data: any[] }>("/kpis", { months: months.join(","), ...(fy ? { fy } : {}) }),
    kpisAggregate: (months: string[], fy?: string) => get<{ data: Record<string, number | null> }>("/kpis/aggregate", { months: months.join(","), ...(fy ? { fy } : {}) }),
    directExpenses: (months: string[], fy?: string) => get<{ data: any[] }>("/direct_expenses", { months: months.join(","), ...(fy ? { fy } : {}) }),
    contribution: (months: string[], fy?: string) => get<{ data: any[] }>("/contribution", { months: months.join(","), ...(fy ? { fy } : {}) }),
    uploadAndProcess: async (params: {
        coreFile?: File | null;
        balanceFile?: File | null;
        salaryFile?: File | null;
        itemSalesFile?: File | null;
        fy: string;
        months: string;
        replaceExisting?: boolean;
    }) => {
        const form = new FormData();
        if (params.coreFile) form.append("core_file", params.coreFile);
        if (params.balanceFile) form.append("balance_file", params.balanceFile);
        if (params.salaryFile) form.append("salary_file", params.salaryFile);
        if (params.itemSalesFile) form.append("item_sales_file", params.itemSalesFile);
        form.append("fy", params.fy);
        form.append("months", params.months);
        form.append("replace_existing", String(params.replaceExisting ?? false));
        const res = await fetch(`${BASE}/upload-and-process`, { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload & process failed");
        return res.json() as Promise<{ ok: boolean; logs: string; user_message?: string | null; error_stage?: string | null; error_detail?: string | null }>;
    },
};
