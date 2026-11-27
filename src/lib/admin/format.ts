// Pure formatting for the record view. No data access.

const BASIS_LABELS: Record<string, string> = {
  "original-cost": "Original cost",
  "fair-market": "Fair market value",
  replacement: "Replacement value",
  "recipient-stated": "Value stated by the recipient",
};

/** A valuation basis in words. Unknown bases show as stored, never as another basis. */
export const basisLabel = (basis: string): string => BASIS_LABELS[basis] ?? basis;

export function usd(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A handover date as precise as the record says it is. */
export function dateWithPrecision(date: string | null, precision: string): string {
  if (!date) return "Date unknown";
  switch (precision) {
    case "day":
      return date;
    case "month":
      return `${date.slice(0, 7)} (month)`;
    case "year":
      return `${date.slice(0, 4)} (year)`;
    default:
      return `${date} (precision unknown)`;
  }
}

/** What an empty value shows as in the record view. */
export const NOT_GIVEN = "not given";

export const orNotGiven = (v: string | number | null | undefined): string => (v === null || v === undefined || v === "" ? NOT_GIVEN : String(v));

/** A raw workbook value as plain text. */
export function rawValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return NOT_GIVEN;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
