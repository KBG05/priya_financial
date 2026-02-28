import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionExpander } from "@/components/SectionExpander";
import { api } from "@/api";
import { buildLedgerData } from "@/lib/pivot";
import type { ViewMode } from "@/types";

interface Props { months: string[]; viewMode: ViewMode; prevMonths: string[]; }

export function DirectExpensesPage({ months, viewMode, prevMonths }: Props) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.directExpenses(months).then(r => { setData(r.data); setLoading(false); });
    }, [months.join(",")]);

    if (loading) return <div className="flex flex-col gap-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

    const categories = [...new Set(data.map((r: any) => r.category))].sort();

    return (
        <div className="flex flex-col gap-3">
            {categories.map(cat => {
                const items = [...new Set(data.filter((r: any) => r.category === cat).map((r: any) => r.line_item))];
                const { cols, rows } = buildLedgerData(data, "line_item", "value", items, viewMode, months, { rupee: true });
                return <SectionExpander key={cat} title={`📂 ${cat}`} cols={cols} rows={rows} />;
            })}
        </div>
    );
}
