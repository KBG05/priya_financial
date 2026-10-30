import { useCallback, useEffect, useState } from "react";
import { MONTH_ORDER, type Month } from "@/types";
import type { Compare } from "@/lib/review";

export const PAGES = ["overview", "profit", "costs", "inventory", "products", "health", "statements", "quote"] as const;
export type PageId = typeof PAGES[number];

export interface Route {
    page: PageId;
    fy?: string;
    month?: Month;
    compare: Compare;
}

/** Route lives in the hash, e.g. #/costs?fy=26_27&m=Jun&vs=ly, so views can be bookmarked and shared. */
function parse(hash: string): Route {
    const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
    const q = new URLSearchParams(query);
    const page = (PAGES as readonly string[]).includes(path) ? (path as PageId) : "overview";
    const m = q.get("m");
    return {
        page,
        fy: q.get("fy") ?? undefined,
        month: (MONTH_ORDER as readonly string[]).includes(m ?? "") ? (m as Month) : undefined,
        compare: q.get("vs") === "ly" ? "ly" : "prev",
    };
}

function format(r: Route): string {
    const q = new URLSearchParams();
    if (r.fy) q.set("fy", r.fy);
    if (r.month) q.set("m", r.month);
    if (r.compare === "ly") q.set("vs", "ly");
    const qs = q.toString();
    return `#/${r.page}${qs ? `?${qs}` : ""}`;
}

export function useRoute() {
    const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

    useEffect(() => {
        const onHash = () => setRoute(parse(window.location.hash));
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);

    const navigate = useCallback((patch: Partial<Route>) => {
        const next = { ...parse(window.location.hash), ...patch };
        const hash = format(next);
        if (hash !== window.location.hash) window.location.hash = hash;
    }, []);

    return { route, navigate };
}
