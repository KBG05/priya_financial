/** Flags months far from the median (more than 4 median absolute deviations). */
export function unusualMonths(values: (number | null)[]): boolean[] {
    const v = values.filter((x): x is number => x != null).sort((a, b) => a - b);
    if (v.length < 5) return values.map(() => false);
    const med = v[Math.floor(v.length / 2)];
    const dev = v.map(x => Math.abs(x - med)).sort((a, b) => a - b);
    const mad = dev[Math.floor(dev.length / 2)] || 1;
    return values.map(x => x != null && Math.abs(x - med) > 4 * mad);
}
