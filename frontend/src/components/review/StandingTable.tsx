import { RangeBar, StandingTag, Tag } from "@/components/review/parts";
import type { Standing } from "@/lib/review";

export interface MeasureRow {
    key: string;
    label: string;
    definition: string;
    value: number | null;
    fmt: (v: number) => string;
    standing: Standing | null;
    /** e.g. "May figure" when the balance sheet lags the month under review. */
    asOf?: string | null;
}

export interface MeasureGroup { name?: string; rows: MeasureRow[] }

/**
 * Measures against their own past months: a table on wider screens, stacked
 * rows on a phone so value and standing stay readable.
 */
export function StandingTable({ groups }: { groups: MeasureGroup[] }) {
    const usual = (r: MeasureRow) => r.standing ? `Usual ${r.fmt(r.standing.low)} to ${r.fmt(r.standing.high)} over ${r.standing.samples} months` : null;
    return (
        <>
        {/* Phone: each measure stacks — name, then value and standing, then the range. */}
        <div className="sm:hidden flex flex-col">
            {groups.map((g, gi) => (
                <div key={g.name ?? gi}>
                    {g.name && <h4 className="pt-4 pb-1 text-[13px] font-bold text-muted-foreground">{g.name}</h4>}
                    <ul>
                        {g.rows.map(r => (
                            <li key={r.key} className="py-3 border-b border-border">
                                <p className="font-semibold">{r.label}</p>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <span className="font-bold tabnum">
                                        {r.value == null ? "—" : r.fmt(r.value)}
                                        {r.asOf && <span className="ml-1.5 text-[12.5px] font-normal text-muted-foreground">{r.asOf}</span>}
                                    </span>
                                    {r.value == null ? <Tag tone="neutral">Not reported</Tag> : <StandingTag standing={r.standing} />}
                                </div>
                                {r.value != null && r.standing && (
                                    <div className="mt-2">
                                        <RangeBar value={r.value} min={r.standing.min} max={r.standing.max} low={r.standing.low} high={r.standing.high} label={`${r.fmt(r.value)}; ${usual(r)}`} />
                                    </div>
                                )}
                                <p className="mt-1 text-[13px] text-muted-foreground">{r.definition}</p>
                                {usual(r) && <p className="text-[12.5px] text-muted-foreground tabnum">{usual(r)}</p>}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
        <table className="hidden sm:table w-full border-collapse">
            <thead>
                <tr>
                    <th scope="col" className="text-left text-[12.5px] font-semibold text-muted-foreground px-2.5 py-2 border-b border-border">Measure</th>
                    <th scope="col" className="text-right text-[12.5px] font-semibold text-muted-foreground px-2.5 py-2 border-b border-border">Now</th>
                    <th scope="col" className="text-left text-[12.5px] font-semibold text-muted-foreground px-2.5 py-2 border-b border-border w-[30%]">Past months</th>
                    <th scope="col" className="text-left text-[12.5px] font-semibold text-muted-foreground px-2.5 py-2 border-b border-border">Standing</th>
                </tr>
            </thead>
            {groups.map((g, gi) => (
                <tbody key={g.name ?? gi}>
                    {g.name && (
                        <tr><th colSpan={4} scope="colgroup" className="text-left pt-4 pb-1 px-2.5 text-[13px] font-bold text-muted-foreground">{g.name}</th></tr>
                    )}
                    {g.rows.map(r => (
                        <tr key={r.key}>
                            <th scope="row" className="text-left px-2.5 py-3 border-b border-border font-semibold align-top">
                                {r.label}
                                <span className="block text-[13px] font-normal text-muted-foreground">{r.definition}</span>
                            </th>
                            <td className="px-2.5 py-3 border-b border-border text-right tabnum font-bold whitespace-nowrap align-top">
                                {r.value == null ? "—" : r.fmt(r.value)}
                                {r.asOf && <span className="block text-[12.5px] font-normal text-muted-foreground">{r.asOf}</span>}
                            </td>
                            <td className="px-2.5 py-3 border-b border-border align-top">
                                {r.value != null && r.standing ? (
                                    <>
                                        <RangeBar
                                            value={r.value} min={r.standing.min} max={r.standing.max} low={r.standing.low} high={r.standing.high}
                                            label={`${r.fmt(r.value)}; ${usual(r)}`}
                                        />
                                        <span className="block mt-1 text-[12.5px] text-muted-foreground tabnum">{usual(r)}</span>
                                    </>
                                ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-2.5 py-3 border-b border-border align-top">
                                {r.value == null ? <Tag tone="neutral">Not reported</Tag> : <StandingTag standing={r.standing} />}
                            </td>
                        </tr>
                    ))}
                </tbody>
            ))}
        </table>
        </>
    );
}
