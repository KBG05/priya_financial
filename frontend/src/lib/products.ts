/** "20MESHMQ42\"BLACK" → "20MESH MQ 42\" Black": the Tally codes, made readable. */
export function productName(raw: string): string {
    return raw
        .replace(/(\d+MESH)(S?[HML]Q)/, "$1 $2 ")
        .replace(/([A-Z]+)(\d+")/, "$1 $2")
        .replace(/"([A-Z])/, "\" $1")
        .replace(/\b([A-Z]{3,})\b/g, w => (/(MESH|HQ|MQ|LQ|SHQ)$/.test(w) ? w : w[0] + w.slice(1).toLowerCase()))
        .replace(/\s+/g, " ")
        .trim();
}
