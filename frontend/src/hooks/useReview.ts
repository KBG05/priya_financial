import { useCallback, useEffect, useState } from "react";
import { loadReview, type Review } from "@/lib/review";
import type { Period } from "@/lib/period";

export type ReviewState =
    | { status: "loading"; review: Review | null }
    | { status: "ready"; review: Review }
    | { status: "error"; review: Review | null; error: string };

/** Loads the month's review; keeps the previous review visible while the next one loads. */
export function useReview(period: Period | null, availableFys: string[]) {
    const [state, setState] = useState<ReviewState>({ status: "loading", review: null });
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt(a => a + 1), []);

    useEffect(() => {
        if (!period || availableFys.length === 0) return;
        let cancelled = false;
        setState(s => ({ status: "loading", review: s.review }));
        loadReview(period, availableFys)
            .then(review => { if (!cancelled) setState({ status: "ready", review }); })
            .catch(err => {
                if (!cancelled) setState(s => ({ status: "error", review: s.review, error: err instanceof Error ? err.message : String(err) }));
            });
        return () => { cancelled = true; };
    }, [period?.fy, period?.month, availableFys.join(","), attempt]);

    return { ...state, retry };
}
