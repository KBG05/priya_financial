import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Verdict, Section, Th, Td, Notice, UploadButton } from "@/components/review/parts";
import { count, inr, kg, perKg } from "@/lib/money";
import { label } from "@/lib/period";
import { monthName } from "@/lib/narrative";
import type { ContribRow } from "@/lib/review";
import { productName } from "@/lib/products";
import type { ReviewPageProps } from "@/pages/types";
import { cn } from "@/lib/utils";

const quoteHref = (id: number) => `#/quote?sku=${id}`;

export function ProductsPage({ review }: ReviewPageProps) {
    const { cur, contribution } = review;
    const month = monthName(cur);

    if (!contribution) {
        return (
            <>
                <Verdict>Product margins for {label(cur.period)} are not available yet.</Verdict>
                <Notice action={<UploadButton>Upload item sales</UploadButton>}>
                    Contribution per product needs the item-level sales file for {month}. The rest of the review does not depend on it.
                </Notice>
            </>
        );
    }

    const losers = contribution.filter(r => r.contribution_per_kg < 0).sort((a, b) => a.contribution_value - b.contribution_value);
    const earners = [...contribution].filter(r => r.contribution_per_kg >= 0).sort((a, b) => b.contribution_value - a.contribution_value);
    const totalContrib = contribution.reduce((s, r) => s + r.contribution_value, 0);
    const revenue = contribution.reduce((s, r) => s + r.revenue, 0);
    const lossValue = losers.reduce((s, r) => s + r.contribution_value, 0);
    const lossKg = losers.reduce((s, r) => s + r.qty, 0);
    const topShare = earners.slice(0, 10).reduce((s, r) => s + r.contribution_value, 0) / (totalContrib || 1);

    return (
        <>
            <Verdict
                figures={[
                    { label: "Products sold", value: count(contribution.length), note: `${inr(revenue)} of product revenue` },
                    { label: "Contribution", value: inr(totalContrib), note: "After material, conversion and fabrication" },
                    { label: "Sold below cost", value: <span className={losers.length ? "text-destructive" : undefined}>{count(losers.length)}</span>, note: `${kg(lossKg)} sold at a loss` },
                    { label: "Lost on those sales", value: <span className={lossValue < 0 ? "text-destructive" : undefined}>{inr(lossValue)}</span> },
                ]}
            >
                {losers.length
                    ? <><span className="text-destructive">{losers.length} of {contribution.length} products sold below cost</span> in {month}, losing {inr(Math.abs(lossValue))}. The ten best earners brought in {Math.round(topShare * 100)}% of all contribution.</>
                    : <>All {contribution.length} products sold in {month} earned a contribution, {inr(totalContrib)} in total.</>}
            </Verdict>

            {losers.length > 0 && (
                <Section
                    finding={`${productName(losers[0].product_name)} lost the most: ${inr(Math.abs(losers[0].contribution_value))} on ${kg(losers[0].qty)}`}
                    note="Every product sold below its cost this month, worst first. Open one in Quote Builder to find a price that covers its cost."
                >
                    <ProductTable rows={losers.slice(0, 10)} action />
                    {losers.length > 10 && <p className="mt-3 text-[13px] text-muted-foreground">{losers.length - 10} more below cost in the full table below.</p>}
                </Section>
            )}

            <Section
                finding={earners.length ? `${productName(earners[0].product_name)} earned the most: ${inr(earners[0].contribution_value)} at ${perKg(earners[0].contribution_per_kg)}` : "No product earned a contribution"}
                note="The ten products that contributed most this month."
            >
                <ProductTable rows={earners.slice(0, 10)} />
            </Section>

            <AllProducts rows={contribution} />
        </>
    );
}

function ProductTable({ rows, action }: { rows: ContribRow[]; action?: boolean }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[720px]">
                <thead><tr>
                    <Th>Product</Th><Th right>Sold</Th><Th right>Selling price</Th><Th right>Contribution per kg</Th><Th right>Contribution</Th>{action && <Th><span className="sr-only">Action</span></Th>}
                </tr></thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.product_id}>
                            <th scope="row" className="text-left px-2.5 py-2.5 border-b border-border font-semibold">{productName(r.product_name)}</th>
                            <Td right>{kg(r.qty)}</Td>
                            <Td right>{perKg(r.selling_price_per_kg)}</Td>
                            <Td right className={r.contribution_per_kg < 0 ? "text-destructive font-semibold" : "text-primary font-semibold"}>{perKg(r.contribution_per_kg, { signed: true })}</Td>
                            <Td right strong className={r.contribution_value < 0 ? "text-destructive" : undefined}>{inr(r.contribution_value, { lakhDigits: 2 })}</Td>
                            {action && (
                                <Td className="text-right">
                                    <a href={quoteHref(r.product_id)} className="inline-flex rounded-lg border border-primary/40 px-2.5 py-1 text-[13px] font-bold text-primary hover:bg-primary-soft whitespace-nowrap">
                                        Reprice
                                    </a>
                                </Td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

type SortKey = "product_name" | "qty" | "selling_price_per_kg" | "contribution_per_kg" | "contribution_value";

function AllProducts({ rows }: { rows: ContribRow[] }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "contribution_value", dir: 1 });

    const shown = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return rows
            .filter(r => !needle || r.product_name.toLowerCase().includes(needle) || productName(r.product_name).toLowerCase().includes(needle))
            .sort((a, b) => {
                const av = a[sort.key], bv = b[sort.key];
                return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
            });
    }, [rows, q, sort]);

    const header = (key: SortKey, text: string, right = true) => {
        const active = sort.key === key;
        return (
            <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-2.5 py-2 border-b border-border", right ? "text-right" : "text-left")}>
                <button
                    type="button"
                    onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : (key === "product_name" ? 1 : -1) }))}
                    className={cn("inline-flex items-center gap-1 text-[12.5px] font-semibold whitespace-nowrap hover:text-foreground", active ? "text-foreground" : "text-muted-foreground")}
                >
                    {text}
                    {active && (sort.dir === 1 ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />)}
                </button>
            </th>
        );
    };

    return (
        <Section
            finding={`All ${rows.length} products`}
            note="The full contribution sheet: search, and sort by any column."
            action={
                <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="rounded-lg border border-input px-3 py-1.5 text-[13px] font-bold hover:bg-accent transition-colors">
                    {open ? "Hide table" : "Show table"}
                </button>
            }
        >
            {open && (
                <div className="animate-settle">
                    <label className="relative block max-w-sm mb-3">
                        <span className="sr-only">Search products</span>
                        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            value={q}
                            onChange={e => setQ(e.target.value)}
                            placeholder="Search by name, e.g. 40MESH or white"
                            className="w-full h-9 rounded-lg border border-input bg-card pl-9 pr-3 placeholder:text-muted-foreground"
                        />
                    </label>
                    <div className="overflow-auto max-h-[560px] border border-border rounded-lg">
                        <table className="w-full border-collapse min-w-[720px]">
                            <thead className="sticky top-0 bg-card z-10"><tr>
                                {header("product_name", "Product", false)}
                                {header("qty", "Sold")}
                                {header("selling_price_per_kg", "Selling price")}
                                {header("contribution_per_kg", "Contribution per kg")}
                                {header("contribution_value", "Contribution")}
                            </tr></thead>
                            <tbody>
                                {shown.map(r => (
                                    <tr key={r.product_id}>
                                        <th scope="row" className="text-left px-2.5 py-2 border-b border-border font-semibold">
                                            <a href={quoteHref(r.product_id)} className="hover:underline underline-offset-4">{productName(r.product_name)}</a>
                                        </th>
                                        <Td right>{kg(r.qty)}</Td>
                                        <Td right>{perKg(r.selling_price_per_kg)}</Td>
                                        <Td right className={r.contribution_per_kg < 0 ? "text-destructive" : undefined}>{perKg(r.contribution_per_kg, { signed: true })}</Td>
                                        <Td right strong className={r.contribution_value < 0 ? "text-destructive" : undefined}>{inr(r.contribution_value, { lakhDigits: 2 })}</Td>
                                    </tr>
                                ))}
                                {shown.length === 0 && (
                                    <tr><td colSpan={5} className="px-2.5 py-6 text-center text-muted-foreground">No product matches "{q}". Clear the search to see all {rows.length}.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Section>
    );
}
