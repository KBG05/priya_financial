/** Plain names for Tally ledger heads. Statements keep the original names. */
const EXPENSE: Record<string, string> = {
    "Admn Expns": "Admin expenses",
    "Selling Expns": "Selling expenses",
    "Finance Cost-Int On Deposits": "Interest on deposits",
    "Finance Cost-Int On Term Loan": "Interest on term loan",
    "Employees welfare exp": "Employee welfare",
    "Salaries Office": "Office salaries",
    "Directors Remuneration": "Directors' pay",
    "Working Capital-LC": "Letter of credit charges",
    "Working Capital-OCC": "Overdraft interest",
    "Working Capital-Bank Charges": "Bank charges",
    "Wages-Yarn": "Wages, yarn",
    "Wages-Fabric": "Wages, fabric",
    "Wages-Inspection & Dispatch": "Wages, inspection and dispatch",
    "R & M-Machinery": "Repairs, machinery",
    "R & M-Electricals": "Repairs, electricals",
    "Power Bill": "Power",
    "Misc": "Miscellaneous",
    "Variable-Trading": "Trading costs",
    "Yarn Processing charges": "Yarn processing",
    "Fabrication charges": "Fabrication charges",
    "Freight Inwards": "Freight inwards",
    "Depreciation": "Depreciation",
    "Rent": "Rent",
};

export const expenseName = (raw: string) => EXPENSE[raw] ?? raw;
