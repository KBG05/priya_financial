import { CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmt } from "@/lib/format";

interface TrendChartProps {
    title: string;
    data: any[];
    dataKey: string;
    options?: string[];
    selectedOption?: string;
    onOptionChange?: (val: string) => void;
    rupee?: boolean;
    pct?: boolean;
    color?: string;
}

export function TrendChart({
    title, data, dataKey, options, selectedOption, onOptionChange, rupee, pct, color = "hsl(var(--primary))"
}: TrendChartProps) {
    const formatter = (value: number) => fmt(value, { rupee, pct });

    return (
        <Card className="flex flex-col card-elevated min-w-0 w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
                {options && options.length > 0 && selectedOption && onOptionChange && (
                    <Select value={selectedOption} onValueChange={onOptionChange}>
                        <SelectTrigger className="w-[180px] h-8 text-xs font-semibold">
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
                        <LineChart
                            data={data}
                            margin={{ left: 10, right: 10, top: 8, bottom: 16 }}
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
                                tickMargin={8}
                                tickFormatter={formatter}
                                width={80}
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <Tooltip
                                cursor={false}
                                formatter={(v: any) => [formatter(Number(v)), title]}
                                contentStyle={{
                                    background: "hsl(var(--popover))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: "hsl(var(--popover-foreground))",
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
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
