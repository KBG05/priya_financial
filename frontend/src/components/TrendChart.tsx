import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip, ComposedChart, Bar } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt } from "@/lib/format";

interface TrendChartProps {
    title: string;
    data: any[];
    dataKey: string;
    combo?: boolean;
    barKey?: string;
    lineKey?: string;
    qtyKey?: string;
    options?: string[];
    selectedOption?: string;
    onOptionChange?: (val: string) => void;
    rupee?: boolean;
    pct?: boolean;
    color?: string;
    barColor?: string;
    lineColor?: string;
    barRupee?: boolean;
    lineRupee?: boolean;
}

export function TrendChart({
    title,
    data,
    dataKey,
    combo,
    barKey,
    lineKey,
    qtyKey,
    options,
    selectedOption,
    onOptionChange,
    rupee,
    pct,
    color = "hsl(var(--primary))",
    barColor = "hsl(var(--primary))",
    lineColor = "#ff8c42",
    barRupee,
    lineRupee,
}: TrendChartProps) {
    const formatter = (value: number) => fmt(value, { rupee, pct });
    const barFormatter = (value: number) => fmt(value, { rupee: barRupee ?? rupee, pct });
    const lineFormatter = (value: number) => fmt(value, { rupee: lineRupee ?? false, pct: false });
    const hasCombo = Boolean(combo && barKey && lineKey);

    return (
        <Card className="flex flex-col card-elevated min-w-0 w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
                {options && options.length > 0 && selectedOption && onOptionChange && (
                    <Select value={selectedOption} onValueChange={onOptionChange}>
                        <SelectTrigger className="w-45 h-8 text-xs font-semibold">
                            <SelectValue placeholder="Select option" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                            {options.map(opt => (
                                <SelectItem key={opt} value={opt} className="text-xs">
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </CardHeader>
            <CardContent className="pb-3 px-2 sm:px-4">
                {/* Plain div with fixed pixel height — bypasses ChartContainer's aspect-video override */}
                <div style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {hasCombo ? (
                            <ComposedChart
                                data={data}
                                margin={{ left: 0, right: 0, top: 8, bottom: 16 }}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <YAxis
                                    yAxisId="value"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    tickFormatter={barFormatter}
                                    width={112}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <YAxis
                                    yAxisId="rate"
                                    orientation="right"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    tickFormatter={lineFormatter}
                                    width={72}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <Tooltip
                                    cursor={false}
                                    content={(props: any) => {
                                        const { active, payload, label } = props;
                                        if (!active || !payload) return null;
                                        const qty = qtyKey && payload?.[0]?.payload?.[qtyKey];
                                        return (
                                            <div className="bg-popover border border-border rounded-lg p-3 text-xs text-popover-foreground shadow-md">
                                                <div className="font-semibold mb-2 text-sm">{label}{qty ? ` • Qty: ${fmt(Number(qty) || 0)}` : ""}</div>
                                                <div className="space-y-1.5">
                                                    {payload.map((entry: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between gap-3">
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                <span className="font-medium text-muted-foreground">
                                                                    {entry.name === barKey ? "Value" : entry.name === lineKey ? "Rate" : entry.name}
                                                                </span>
                                                            </span>
                                                            <span className="font-semibold">
                                                                {entry.name === barKey ? barFormatter(Number(entry.value)) : entry.name === lineKey ? lineFormatter(Number(entry.value)) : formatter(Number(entry.value))}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Bar yAxisId="value" dataKey={barKey!} fill={barColor} radius={[3, 3, 0, 0]} />
                                <Line
                                    yAxisId="rate"
                                    type="linear"
                                    dataKey={lineKey!}
                                    stroke={lineColor}
                                    strokeWidth={2}
                                    dot={{ fill: lineColor, r: 3 }}
                                    activeDot={{ r: 5 }}
                                />
                            </ComposedChart>
                        ) : (
                            <LineChart
                                data={data}
                                margin={{ left: 0, right: 0, top: 8, bottom: 16 }}
                            >
                                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={4}
                                    tickFormatter={formatter}
                                    width={112}
                                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                />
                                <Tooltip
                                    cursor={false}
                                    content={(props: any) => {
                                        const { active, payload, label } = props;
                                        if (!active || !payload) return null;
                                        return (
                                            <div className="bg-popover border border-border rounded-lg p-3 text-xs text-popover-foreground shadow-md">
                                                <div className="font-semibold mb-2 text-sm">{label}</div>
                                                <div className="space-y-1.5">
                                                    {payload.map((entry: any, idx: number) => (
                                                        <div key={idx} className="flex items-center justify-between gap-3">
                                                            <span className="flex items-center gap-2">
                                                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                <span className="font-medium text-muted-foreground">{entry.name}</span>
                                                            </span>
                                                            <span className="font-semibold">{formatter(Number(entry.value))}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Line
                                    type="linear"
                                    dataKey={dataKey}
                                    stroke={color}
                                    strokeWidth={2}
                                    dot={{ fill: color, r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
