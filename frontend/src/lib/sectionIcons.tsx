import {
    TrendingUp, Package, Wrench, Receipt, LineChart, BarChart3,
    Settings2, Landmark, Folder, DollarSign,
} from "lucide-react";
import type { ElementType } from "react";

const RULES: [RegExp, ElementType][] = [
    [/revenue|sales/i, TrendingUp],
    [/purchase|stock|material/i, Package],
    [/direct expens|fabrication|consumption/i, Wrench],
    [/overhead|indirect/i, Receipt],
    [/profit|pal/i, LineChart],
    [/variable/i, Settings2],
    [/fixed cost/i, Landmark],
    [/breakdown/i, BarChart3],
];

/** Strip a leading emoji/symbol run (and following space) from a title string */
export function stripLeadingEmoji(title: string): string {
    return title.replace(/^[^\w\s]+\s*/u, "").trim();
}

/** Resolve a lucide icon for a section title using keyword rules, falling back to a generic folder/currency icon */
export function sectionIcon(title: string): ElementType {
    const clean = stripLeadingEmoji(title);
    for (const [re, Icon] of RULES) {
        if (re.test(clean)) return Icon;
    }
    return clean.length <= 3 ? DollarSign : Folder;
}
