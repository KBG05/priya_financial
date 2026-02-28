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
    months: () => get<{ months: string[] }>("/months"),
    pal1: (months: string[]) => get<{ data: any[] }>("/pal1", { months: months.join(",") }),
    mty: (months: string[]) => get<{ data: any[] }>("/mty", { months: months.join(",") }),
    consumption: (months: string[]) => get<{ data: any[] }>("/consumption", { months: months.join(",") }),
    kpis: (months: string[]) => get<{ data: any[] }>("/kpis", { months: months.join(",") }),
    directExpenses: (months: string[]) => get<{ data: any[] }>("/direct_expenses", { months: months.join(",") }),
};
